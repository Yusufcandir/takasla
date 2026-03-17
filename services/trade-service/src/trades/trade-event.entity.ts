import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { TradeEntity } from './trade.entity';

@Entity('trade_events')
export class TradeEventEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trade_id', type: 'uuid' })
  tradeId!: string;

  @ManyToOne(() => TradeEntity)
  @JoinColumn({ name: 'trade_id' })
  trade!: TradeEntity;

  @Column({ name: 'event_type', length: 50 })
  eventType!: string;

  @Column({ name: 'from_state', length: 30, nullable: true })
  fromState?: string;

  @Column({ name: 'to_state', length: 30, nullable: true })
  toState?: string;

  @Column({ type: 'jsonb', default: '{}' })
  payload!: Record<string, unknown>;

  @Column({ name: 'triggered_by', type: 'uuid', nullable: true })
  triggeredBy?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
