import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ListingEntity } from './listing.entity';

@Entity('listing_images')
export class ListingImageEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'listing_id', type: 'uuid' })
  listingId!: string;

  @ManyToOne(() => ListingEntity, (listing) => listing.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listing_id' })
  listing!: ListingEntity;

  @Column({ length: 500 })
  url!: string;

  @Column({ name: 'thumbnail_url', length: 500, nullable: true })
  thumbnailUrl?: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder!: number;

  @Column({ name: 'ai_score', type: 'float', nullable: true })
  aiScore?: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
