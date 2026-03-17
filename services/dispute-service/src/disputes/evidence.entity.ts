import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DisputeEntity } from './dispute.entity';

@Entity('evidence')
export class EvidenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'dispute_id', type: 'uuid' })
  disputeId!: string;

  @ManyToOne(() => DisputeEntity, (d) => d.evidence)
  @JoinColumn({ name: 'dispute_id' })
  dispute!: DisputeEntity;

  @Column({ name: 'uploaded_by', type: 'uuid' })
  uploadedBy!: string;

  @Column({ type: 'varchar', length: 20 })
  type!: string;

  @Column({ length: 500, nullable: true })
  url?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'file_hash', length: 128, nullable: true })
  fileHash?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
