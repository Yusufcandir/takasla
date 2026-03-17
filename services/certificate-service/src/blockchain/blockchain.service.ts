import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ethers } from 'ethers';
import { BlockchainAnchorEntity } from './anchor.entity';
import { MerkleService } from '../merkle/merkle.service';
import { AnchorStatus, ROUTING_KEYS } from '@exchange/shared-types';
import { RabbitMQService } from '@exchange/common';
import { v4 as uuidv4 } from 'uuid';

const MERKLE_ANCHOR_ABI = [
  'function anchor(bytes32 merkleRoot) external',
  'function getAnchor(bytes32 merkleRoot) external view returns (uint256 timestamp, address submitter)',
  'event Anchored(bytes32 indexed merkleRoot, uint256 timestamp, address submitter)',
];

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;

  constructor(
    @InjectRepository(BlockchainAnchorEntity)
    private readonly anchorRepo: Repository<BlockchainAnchorEntity>,
    private readonly merkleService: MerkleService,
    private readonly config: ConfigService,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async onModuleInit() {
    const rpcUrl = this.config.get<string>('SEPOLIA_RPC_URL');
    const privateKey = this.config.get<string>('SEPOLIA_PRIVATE_KEY');
    const contractAddress = this.config.get<string>('MERKLE_ANCHOR_CONTRACT_ADDRESS');

    if (rpcUrl && privateKey && contractAddress) {
      this.provider = new ethers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      this.contract = new ethers.Contract(contractAddress, MERKLE_ANCHOR_ABI, this.wallet);
      this.logger.log('Blockchain service initialized with Sepolia connection');
    } else {
      this.logger.warn('Blockchain service running in simulation mode (missing config)');
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async anchorPendingTrees(): Promise<void> {
    const trees = await this.merkleService.getUnanchoredTrees();
    for (const tree of trees) {
      try {
        await this.anchorMerkleRoot(tree.id, tree.rootHash);
      } catch (error) {
        this.logger.error(`Failed to anchor tree ${tree.id}`, error);
      }
    }
  }

  async anchorMerkleRoot(merkleTreeId: string, rootHash: string): Promise<BlockchainAnchorEntity> {
    const anchor = await this.anchorRepo.save({
      merkleTreeId,
      txHash: 'pending',
      status: AnchorStatus.PENDING as AnchorStatus,
      network: 'sepolia',
      contractAddress: this.config.get<string>('MERKLE_ANCHOR_CONTRACT_ADDRESS', ''),
    });

    try {
      let txHash: string;
      let blockNumber: number | undefined;
      let gasUsed: number | undefined;

      if (this.contract && this.wallet) {
        const hex = rootHash.startsWith('0x') ? rootHash : `0x${rootHash}`;
        const merkleRootBytes = ethers.zeroPadValue(hex, 32);
        const tx = await this.contract.anchor(merkleRootBytes);
        const receipt = await tx.wait();
        txHash = receipt.hash;
        blockNumber = receipt.blockNumber;
        gasUsed = Number(receipt.gasUsed);
      } else {
        // Simulation mode
        txHash = `0xSIM_${uuidv4().replace(/-/g, '')}`;
        blockNumber = Math.floor(Math.random() * 1000000);
        gasUsed = 45000;
        this.logger.log(`[SIMULATION] Anchored merkle root: ${rootHash}`);
      }

      anchor.txHash = txHash;
      anchor.blockNumber = blockNumber;
      anchor.gasUsed = gasUsed;
      anchor.status = AnchorStatus.CONFIRMED;
      await this.anchorRepo.save(anchor);

      await this.merkleService.markAnchored(merkleTreeId);

      await this.rabbitMQService.publish(ROUTING_KEYS.CERTIFICATE.ANCHORED, {
        eventId: uuidv4(),
        correlationId: uuidv4(),
        idempotencyKey: `anchor:${merkleTreeId}`,
        merkleTreeId,
        merkleRoot: rootHash,
        txHash,
        network: 'sepolia',
      });

      this.logger.log(`Merkle root anchored: tree=${merkleTreeId}, tx=${txHash}`);
      return anchor;
    } catch (error) {
      anchor.status = AnchorStatus.FAILED;
      await this.anchorRepo.save(anchor);
      throw error;
    }
  }

  async buildAndAnchor(): Promise<{ tree: string | null; anchor: string | null }> {
    const tree = await this.merkleService.buildDailyMerkleTree();
    if (!tree) {
      this.logger.log('No unanchored certificates to build/anchor');
      return { tree: null, anchor: null };
    }
    const anchor = await this.anchorMerkleRoot(tree.id, tree.rootHash);
    return { tree: tree.id, anchor: anchor.txHash };
  }

  async getAnchorByTreeId(merkleTreeId: string): Promise<BlockchainAnchorEntity | null> {
    return this.anchorRepo.findOne({ where: { merkleTreeId } });
  }
}
