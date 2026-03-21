import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('fraud_flags')
export class FraudFlagEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'flag_type', type: 'varchar', length: 50 })
  flagType!: string; // 'circular_trading' | 'same_address' | 'rapid_rating' | 'velocity_abuse'

  @Column({ type: 'text' })
  description!: string;

  @Column({ type: 'jsonb', default: '{}' })
  evidence!: Record<string, unknown>;

  @Column({ name: 'related_user_id', type: 'uuid', nullable: true })
  relatedUserId?: string;

  @Column({ name: 'related_trade_id', type: 'uuid', nullable: true })
  relatedTradeId?: string;

  @Column({ default: false })
  reviewed!: boolean;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy?: string;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt?: Date;

  @Column({ name: 'review_notes', type: 'text', nullable: true })
  reviewNotes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
