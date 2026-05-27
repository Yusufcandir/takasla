import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { DisputeStatus, DisputeReason, DisputeOutcome, CompensationAction, AppealStatus } from '@exchange/shared-types';
import { EvidenceEntity } from './evidence.entity';

@Entity('disputes')
export class DisputeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trade_id', type: 'uuid' })
  tradeId!: string;

  @Column({ name: 'opened_by', type: 'uuid' })
  openedBy!: string;

  @Column({ type: 'varchar', length: 50 })
  reason!: DisputeReason;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'varchar', length: 20, default: DisputeStatus.OPEN })
  status!: DisputeStatus;

  @Column({ type: 'text', nullable: true })
  resolution?: string;

  @Column({ name: 'resolved_by', type: 'uuid', nullable: true })
  resolvedBy?: string;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date;

  // Structured outcome fields
  @Column({ name: 'outcome_type', type: 'varchar', length: 30, nullable: true })
  outcomeType?: DisputeOutcome;

  @Column({ name: 'compensation_action', type: 'varchar', length: 30, nullable: true })
  compensationAction?: CompensationAction;

  @Column({ name: 'compensation_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  compensationAmount?: number;

  // Appeal fields
  @Column({ name: 'appeal_status', type: 'varchar', length: 20, default: AppealStatus.NONE })
  appealStatus!: AppealStatus;

  @Column({ name: 'appealed_by', type: 'uuid', nullable: true })
  appealedBy?: string;

  @Column({ name: 'appeal_reason', type: 'text', nullable: true })
  appealReason?: string;

  @Column({ name: 'appeal_deadline', type: 'timestamptz', nullable: true })
  appealDeadline?: Date;

  // Center inspection fields (ship-to-center flow)
  @Column({ name: 'center_id', type: 'uuid', nullable: true })
  centerId?: string;

  @Column({ name: 'shipment_code', type: 'varchar', length: 20, nullable: true })
  shipmentCode?: string;

  @Column({ name: 'center_received_at', type: 'timestamptz', nullable: true })
  centerReceivedAt?: Date;

  // SLA deadline for moderator response
  @Column({ name: 'sla_deadline', type: 'timestamptz', nullable: true })
  slaDeadline?: Date;

  @Column({ name: 'escalated_at', type: 'timestamptz', nullable: true })
  escalatedAt?: Date;

  @OneToMany(() => EvidenceEntity, (e) => e.dispute, { cascade: true })
  evidence!: EvidenceEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
