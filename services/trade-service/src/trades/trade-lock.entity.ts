import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { TradeEntity } from './trade.entity';

@Entity('trade_locks')
export class TradeLockEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trade_id', type: 'uuid' })
  tradeId!: string;

  @ManyToOne(() => TradeEntity)
  @JoinColumn({ name: 'trade_id' })
  trade!: TradeEntity;

  @Column({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @Column({ name: 'locked_by', type: 'uuid' })
  lockedBy!: string;

  @CreateDateColumn({ name: 'locked_at', type: 'timestamptz' })
  lockedAt!: Date;

  @Column({ name: 'released_at', type: 'timestamptz', nullable: true })
  releasedAt?: Date;

  @Column({ name: 'lock_type', length: 20, default: 'escrow' })
  lockType!: string;
}
