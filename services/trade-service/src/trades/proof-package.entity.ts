import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { TradeEntity } from './trade.entity';

@Entity('proof_packages')
export class ProofPackageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trade_id', type: 'uuid' })
  tradeId!: string;

  @ManyToOne(() => TradeEntity)
  @JoinColumn({ name: 'trade_id' })
  trade!: TradeEntity;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'jsonb' })
  items!: Array<{ type: string; url: string; hash: string }>;

  @Column({ name: 'package_hash', length: 128, nullable: true })
  packageHash?: string;

  @Column({ type: 'jsonb', default: '{}' })
  metadata!: Record<string, unknown>; // EXIF data, flags, warnings

  @CreateDateColumn({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt!: Date;
}
