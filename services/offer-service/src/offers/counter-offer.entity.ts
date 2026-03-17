import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { OfferEntity } from './offer.entity';

@Entity('counter_offers')
export class CounterOfferEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'original_offer_id', type: 'uuid' })
  originalOfferId!: string;

  @ManyToOne(() => OfferEntity)
  @JoinColumn({ name: 'original_offer_id' })
  originalOffer!: OfferEntity;

  @Column({ name: 'proposed_listing_id', type: 'uuid' })
  proposedListingId!: string;

  @Column({ name: 'proposed_by', type: 'uuid' })
  proposedBy!: string;

  @Column({ type: 'text', nullable: true })
  message?: string;

  @Column({ length: 20, default: 'pending' })
  status!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
