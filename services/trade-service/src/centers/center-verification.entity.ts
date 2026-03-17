import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('center_verifications')
export class CenterVerificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'trade_id', type: 'uuid' })
  tradeId!: string;

  @Column({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @Column({ name: 'center_id', type: 'uuid' })
  centerId!: string;

  @Column({ type: 'varchar', length: 1 })
  party!: string; // 'A' or 'B'

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status!: string; // 'pending' | 'item_received' | 'inspecting' | 'approved' | 'rejected'

  @Column({ name: 'verified_by', type: 'uuid', nullable: true })
  verifiedBy?: string;

  @Column({ name: 'verified_at', type: 'timestamptz', nullable: true })
  verifiedAt?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'photo_urls', type: 'jsonb', default: '[]' })
  photoUrls!: string[];

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string;

  @Column({ name: 'received_at', type: 'timestamptz', nullable: true })
  receivedAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
