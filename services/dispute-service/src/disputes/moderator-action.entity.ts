import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DisputeEntity } from './dispute.entity';

@Entity('moderator_actions')
export class ModeratorActionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'dispute_id', type: 'uuid' })
  disputeId!: string;

  @ManyToOne(() => DisputeEntity)
  @JoinColumn({ name: 'dispute_id' })
  dispute!: DisputeEntity;

  @Column({ name: 'moderator_id', type: 'uuid' })
  moderatorId!: string;

  @Column({ name: 'action_type', length: 30 })
  actionType!: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
