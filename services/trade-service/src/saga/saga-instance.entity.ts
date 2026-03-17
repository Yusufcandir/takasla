import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { TradeEntity } from '../trades/trade.entity';
import { SagaState } from '@exchange/shared-types';

@Entity('saga_instances')
export class SagaInstanceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trade_id', type: 'uuid' })
  tradeId!: string;

  @ManyToOne(() => TradeEntity)
  @JoinColumn({ name: 'trade_id' })
  trade!: TradeEntity;

  @Column({ name: 'saga_type', length: 50 })
  sagaType!: string;

  @Column({ name: 'current_step', length: 50 })
  currentStep!: string;

  @Column({ type: 'varchar', length: 20, default: SagaState.RUNNING })
  state!: SagaState;

  @Column({ name: 'step_data', type: 'jsonb', default: '{}' })
  stepData!: Record<string, unknown>;

  @Column({ type: 'jsonb', default: '[]' })
  compensations!: Array<{ step: string; data: Record<string, unknown> }>;

  @Column({ name: 'idempotency_key', length: 100, unique: true, nullable: true })
  idempotencyKey?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
