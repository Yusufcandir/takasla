import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { CertificateEntity } from './certificate.entity';

@Entity('ownership_transfers')
export class OwnershipTransferEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'certificate_id', type: 'uuid' })
  certificateIdRef!: string;

  @ManyToOne(() => CertificateEntity)
  @JoinColumn({ name: 'certificate_id' })
  certificate!: CertificateEntity;

  @Column({ name: 'from_user_id', type: 'uuid' })
  fromUserId!: string;

  @Column({ name: 'to_user_id', type: 'uuid' })
  toUserId!: string;

  @CreateDateColumn({ name: 'transferred_at', type: 'timestamptz' })
  transferredAt!: Date;
}
