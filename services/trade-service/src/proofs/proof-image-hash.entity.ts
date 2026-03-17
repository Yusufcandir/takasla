import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('proof_image_hashes')
export class ProofImageHashEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'phash', type: 'varchar', length: 64 })
  @Index()
  phash!: string; // perceptual hash (hex string)

  @Column({ name: 'sha256', type: 'varchar', length: 64 })
  sha256!: string; // exact content hash

  @Column({ name: 'trade_id', type: 'uuid' })
  @Index()
  tradeId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId!: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ name: 'is_duplicate', type: 'boolean', default: false })
  isDuplicate!: boolean;

  @Column({ name: 'duplicate_of_trade_id', type: 'uuid', nullable: true })
  duplicateOfTradeId?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
