import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('payments')
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trade_id', type: 'uuid', nullable: true })
  tradeId?: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 30, default: 'trade_fee' })
  type!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'varchar', length: 3, default: 'TRY' })
  currency!: string;

  @Column({ name: 'fee_percentage', type: 'decimal', precision: 5, scale: 4 })
  feePercentage!: number;

  @Column({ name: 'provider_payment_id', nullable: true })
  providerPaymentId?: string;

  @Column({ name: 'provider_checkout_token', nullable: true })
  providerCheckoutToken?: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string;

  @Column({ name: 'escrow_status', type: 'varchar', length: 20, default: 'none' })
  escrowStatus!: string; // 'none' | 'held' | 'released' | 'refunded'

  @Column({ name: 'escrow_released_at', type: 'timestamptz', nullable: true })
  escrowReleasedAt?: Date;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt?: Date;

  @Column({ name: 'refunded_at', type: 'timestamptz', nullable: true })
  refundedAt?: Date;

  @Column({ type: 'jsonb', default: '{}' })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
