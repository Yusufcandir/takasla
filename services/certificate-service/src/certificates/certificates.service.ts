import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { CertificateEntity } from './certificate.entity';
import { OwnershipTransferEntity } from './ownership-transfer.entity';
import { MerkleTreeEntity } from '../merkle/merkle-tree.entity';
import { BlockchainAnchorEntity } from '../blockchain/anchor.entity';
import { CertificateStatus, ROUTING_KEYS, QUEUES } from '@exchange/shared-types';
import { RabbitMQService } from '@exchange/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CertificatesService {
  private readonly logger = new Logger(CertificatesService.name);
  private certCounter = 0;

  constructor(
    @InjectRepository(CertificateEntity)
    private readonly certRepo: Repository<CertificateEntity>,
    @InjectRepository(OwnershipTransferEntity)
    private readonly transferRepo: Repository<OwnershipTransferEntity>,
    @InjectRepository(MerkleTreeEntity)
    private readonly treeRepo: Repository<MerkleTreeEntity>,
    @InjectRepository(BlockchainAnchorEntity)
    private readonly anchorRepo: Repository<BlockchainAnchorEntity>,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async onModuleInit() {
    // Restore counter from DB so IDs don't collide on restart
    const last = await this.certRepo.findOne({ where: {}, order: { issuedAt: 'DESC' } });
    if (last) {
      const parts = last.certificateId.split('-');
      this.certCounter = parseInt(parts[2] ?? '0', 10);
    }

    await this.rabbitMQService.subscribe(
      QUEUES.CERTIFICATE_ON_TRADE,
      [ROUTING_KEYS.TRADE.VERIFIED],
      async (msg) => {
        const { tradeId, proofHashA, proofHashB, riskLevel, partyAId, partyBId, listingAId, listingBId } = msg as any;
        if (riskLevel === 'LOW') return; // no certificate for low risk

        const combinedHash = createHash('sha256')
          .update(`${proofHashA ?? ''}:${proofHashB ?? ''}`)
          .digest('hex');

        // Idempotency: skip if certificates already exist for this trade
        const existing = await this.certRepo.findOne({ where: { tradeId } });
        if (existing) {
          this.logger.log(`Certificates already issued for trade ${tradeId}, skipping`);
          return;
        }

        await this.issueCertificate(tradeId, combinedHash, partyAId, listingAId);
        await this.issueCertificate(tradeId, combinedHash, partyBId, listingBId);
      },
    );
  }

  async issueCertificate(
    tradeId: string,
    proofHash: string,
    ownerUserId: string,
    listingId: string,
  ): Promise<CertificateEntity> {
    this.certCounter++;
    const year = new Date().getFullYear();
    const certificateId = `CERT-${year}-${String(this.certCounter).padStart(6, '0')}`;

    const cert = await this.certRepo.save({
      tradeId,
      certificateId,
      proofHash,
      ownerUserId,
      listingId,
      status: CertificateStatus.ACTIVE,
    });

    await this.rabbitMQService.publish(ROUTING_KEYS.CERTIFICATE.ISSUED, {
      eventId: uuidv4(),
      correlationId: uuidv4(),
      idempotencyKey: `cert:${cert.id}`,
      certificateId: cert.certificateId,
      tradeId,
      proofHash,
      ownerUserId,
      listingId,
    });

    this.logger.log(`Certificate issued: ${certificateId} for trade ${tradeId}`);
    return cert;
  }

  async findByCertificateId(certificateId: string): Promise<CertificateEntity> {
    const cert = await this.certRepo.findOne({ where: { certificateId } });
    if (!cert) throw new NotFoundException('Certificate not found');
    return cert;
  }

  async findByTradeId(tradeId: string): Promise<CertificateEntity[]> {
    return this.certRepo.find({ where: { tradeId } });
  }

  async findByOwner(userId: string): Promise<CertificateEntity[]> {
    return this.certRepo.find({ where: { ownerUserId: userId }, order: { issuedAt: 'DESC' } });
  }

  async getMerkleProof(certificateId: string) {
    const cert = await this.findByCertificateId(certificateId);

    if (!cert.merkleTreeId || cert.leafIndex === null || cert.leafIndex === undefined) {
      return { certificateId, anchored: false, proof: null };
    }

    const tree = await this.treeRepo.findOne({ where: { id: cert.merkleTreeId } });
    if (!tree) return { certificateId, anchored: false, proof: null };

    const leaves = (tree.leaves as Array<{ index: number; certificateId: string; hash: string }>)
      .sort((a, b) => a.index - b.index)
      .map(l => l.hash);

    const proof = this.computeProofPath(leaves, cert.leafIndex);

    const anchor = await this.anchorRepo.findOne({ where: { merkleTreeId: cert.merkleTreeId } });

    return {
      certificateId,
      anchored: true,
      merkleRoot: tree.rootHash,
      leafIndex: cert.leafIndex,
      proof,
      txHash: anchor?.txHash ?? null,
      network: anchor?.network ?? 'sepolia',
      blockNumber: anchor?.blockNumber != null ? String(anchor.blockNumber) : null,
      anchorStatus: anchor?.status ?? null,
    };
  }

  async verifyCertificateIntegrity(certificateId: string) {
    const cert = await this.findByCertificateId(certificateId);
    return {
      certificateId: cert.certificateId,
      status: cert.status,
      proofHash: cert.proofHash,
      isAnchored: !!cert.merkleTreeId,
      merkleTreeId: cert.merkleTreeId,
      leafIndex: cert.leafIndex,
      issuedAt: cert.issuedAt,
    };
  }

  async transferOwnership(certificateId: string, fromUserId: string, toUserId: string): Promise<CertificateEntity> {
    const cert = await this.findByCertificateId(certificateId);

    await this.transferRepo.save({
      certificateIdRef: cert.id,
      fromUserId,
      toUserId,
    });

    cert.ownerUserId = toUserId;
    cert.status = CertificateStatus.TRANSFERRED;
    return this.certRepo.save(cert);
  }

  async revoke(certificateId: string): Promise<CertificateEntity> {
    const cert = await this.findByCertificateId(certificateId);
    cert.status = CertificateStatus.REVOKED;
    cert.revokedAt = new Date();
    return this.certRepo.save(cert);
  }

  async getUnanchoredCertificates(): Promise<CertificateEntity[]> {
    return this.certRepo.find({
      where: { merkleTreeId: undefined as any },
      order: { issuedAt: 'ASC' },
    });
  }

  private computeProofPath(leaves: string[], leafIndex: number): Array<{ hash: string; direction: 'left' | 'right' }> {
    const proof: Array<{ hash: string; direction: 'left' | 'right' }> = [];
    let index = leafIndex;
    let currentLevel = [...leaves];

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;

        if (i === index) {
          proof.push({ hash: right, direction: 'right' });
        } else if (i + 1 === index) {
          proof.push({ hash: left, direction: 'left' });
        }

        nextLevel.push(createHash('sha256').update(left + right).digest('hex'));
      }

      index = Math.floor(index / 2);
      currentLevel = nextLevel;
    }

    return proof;
  }
}
