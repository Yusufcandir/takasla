import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { MerkleTreeEntity } from '../merkle/merkle-tree.entity';
import { AnchorStatus } from '@exchange/shared-types';

@Entity('blockchain_anchors')
export class BlockchainAnchorEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'merkle_tree_id', type: 'uuid' })
  merkleTreeId!: string;

  @ManyToOne(() => MerkleTreeEntity)
  @JoinColumn({ name: 'merkle_tree_id' })
  merkleTree!: MerkleTreeEntity;

  @Column({ name: 'tx_hash', length: 128 })
  txHash!: string;

  @Column({ name: 'block_number', type: 'bigint', nullable: true })
  blockNumber?: number;

  @Column({ length: 30, default: 'sepolia' })
  network!: string;

  @Column({ name: 'contract_address', length: 42, nullable: true })
  contractAddress?: string;

  @CreateDateColumn({ name: 'anchor_timestamp', type: 'timestamptz' })
  anchorTimestamp!: Date;

  @Column({ name: 'gas_used', type: 'bigint', nullable: true })
  gasUsed?: number;

  @Column({ type: 'varchar', length: 20, default: AnchorStatus.PENDING })
  status!: AnchorStatus;
}
