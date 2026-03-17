import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { CertificateStatus } from '@exchange/shared-types';

@Entity('certificates')
export class CertificateEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trade_id', type: 'uuid' })
  tradeId!: string;

  @Column({ name: 'certificate_id', length: 50, unique: true })
  certificateId!: string;

  @Column({ name: 'proof_hash', length: 128 })
  proofHash!: string;

  @Column({ name: 'owner_user_id', type: 'uuid' })
  ownerUserId!: string;

  @Column({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @Column({ type: 'varchar', length: 20, default: CertificateStatus.ACTIVE })
  status!: CertificateStatus;

  @Column({ name: 'merkle_tree_id', type: 'uuid', nullable: true })
  merkleTreeId?: string;

  @Column({ name: 'leaf_index', type: 'int', nullable: true })
  leafIndex?: number;

  @Column({ type: 'jsonb', default: '{}' })
  metadata!: Record<string, unknown>;

  @CreateDateColumn({ name: 'issued_at', type: 'timestamptz' })
  issuedAt!: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt?: Date;
}
