import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { OfferStatus } from '@exchange/shared-types';

@Entity('offers')
export class OfferEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @Column({ name: 'offered_listing_id', type: 'uuid' })
  offeredListingId!: string;

  @Column({ name: 'offerer_id', type: 'uuid' })
  offererId!: string;

  @Column({ name: 'listing_owner_id', type: 'uuid' })
  listingOwnerId!: string;

  @Column({ type: 'varchar', length: 20, default: OfferStatus.PENDING })
  status!: OfferStatus;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Column({ name: 'idempotency_key', length: 100, unique: true, nullable: true })
  idempotencyKey?: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
