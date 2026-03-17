import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MerkleTreeEntity } from './merkle-tree.entity';
import { CertificatesService } from '../certificates/certificates.service';
import { CertificateEntity } from '../certificates/certificate.entity';
import { createHash } from 'crypto';

@Injectable()
export class MerkleService {
  private readonly logger = new Logger(MerkleService.name);

  constructor(
    @InjectRepository(MerkleTreeEntity)
    private readonly treeRepo: Repository<MerkleTreeEntity>,
    @InjectRepository(CertificateEntity)
    private readonly certRepo: Repository<CertificateEntity>,
    private readonly certificatesService: CertificatesService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async buildDailyMerkleTree(): Promise<MerkleTreeEntity | null> {
    const certs = await this.certificatesService.getUnanchoredCertificates();
    if (certs.length === 0) {
      this.logger.log('No unanchored certificates, skipping Merkle tree build');
      return null;
    }

    const leaves = certs.map((cert, index) => ({
      index,
      certificateId: cert.certificateId,
      hash: cert.proofHash,
    }));

    const rootHash = this.computeMerkleRoot(leaves.map((l) => l.hash));

    const now = new Date();
    const periodStart = new Date(now);
    periodStart.setDate(periodStart.getDate() - 1);

    const tree = await this.treeRepo.save({
      rootHash,
      leafCount: leaves.length,
      leaves,
      periodStart,
      periodEnd: now,
      anchored: false,
    });

    // Update certificates with tree reference
    for (const leaf of leaves) {
      await this.certRepo.update(
        { certificateId: leaf.certificateId },
        { merkleTreeId: tree.id, leafIndex: leaf.index },
      );
    }

    this.logger.log(`Merkle tree built: ${tree.id}, root: ${rootHash}, leaves: ${leaves.length}`);
    return tree;
  }

  computeMerkleRoot(hashes: string[]): string {
    if (hashes.length === 0) return createHash('sha256').update('').digest('hex');
    if (hashes.length === 1) return hashes[0];

    const nextLevel: string[] = [];
    for (let i = 0; i < hashes.length; i += 2) {
      const left = hashes[i];
      const right = i + 1 < hashes.length ? hashes[i + 1] : left;
      const combined = createHash('sha256')
        .update(left + right)
        .digest('hex');
      nextLevel.push(combined);
    }

    return this.computeMerkleRoot(nextLevel);
  }

  generateMerkleProof(leaves: string[], leafIndex: number): string[] {
    const proof: string[] = [];
    let index = leafIndex;
    let currentLevel = [...leaves];

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      for (let i = 0; i < currentLevel.length; i += 2) {
        const left = currentLevel[i];
        const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;

        if (i === index || i + 1 === index) {
          proof.push(i === index ? right : left);
        }

        nextLevel.push(
          createHash('sha256').update(left + right).digest('hex'),
        );
      }

      index = Math.floor(index / 2);
      currentLevel = nextLevel;
    }

    return proof;
  }

  async getUnanchoredTrees(): Promise<MerkleTreeEntity[]> {
    return this.treeRepo.find({
      where: { anchored: false },
      order: { createdAt: 'ASC' },
    });
  }

  async markAnchored(treeId: string): Promise<void> {
    await this.treeRepo.update(treeId, { anchored: true });
  }
}
