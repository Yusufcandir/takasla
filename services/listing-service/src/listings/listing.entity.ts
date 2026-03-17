import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ListingStatus, ItemCondition } from '@exchange/shared-types';
import { CategoryEntity } from '../categories/category.entity';
import { ListingImageEntity } from './listing-image.entity';

@Entity('listings')
export class ListingEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId?: string;

  @ManyToOne(() => CategoryEntity, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category?: CategoryEntity;

  @Column({ length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'declared_value', type: 'decimal', precision: 12, scale: 2, default: 0 })
  declaredValue!: number;

  @Column({ length: 3, default: 'TRY' })
  currency!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  condition?: ItemCondition;

  @Column({ type: 'varchar', length: 20, default: ListingStatus.ACTIVE })
  status!: ListingStatus;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  shippingOption?: 'local_pickup' | 'shipping' | 'both';

  @Column({ type: 'varchar', length: 20, nullable: true })
  priceFlexibility?: 'fixed' | 'negotiable' | 'offers_only';

  @Column({ name: 'has_original_packaging', default: false })
  hasOriginalPackaging!: boolean;

  @Column({ name: 'has_purchase_receipt', default: false })
  hasPurchaseReceipt!: boolean;

  @Column({ name: 'has_certificate_of_authenticity', default: false })
  hasCertificateOfAuthenticity!: boolean;

  @Column({ name: 'weight_grams', type: 'int', nullable: true })
  weightGrams?: number;

  @Column({ name: 'min_exchange_value', type: 'decimal', precision: 12, scale: 2, nullable: true })
  minExchangeValue?: number;

  @Column({ name: 'max_exchange_value', type: 'decimal', precision: 12, scale: 2, nullable: true })
  maxExchangeValue?: number;

  @Column({ name: 'preferred_categories', type: 'jsonb', default: '[]' })
  preferredCategories!: string[];

  @Column({ type: 'jsonb', default: '{}' })
  metadata!: Record<string, unknown>;

  @Column({ name: 'is_featured', default: false })
  isFeatured!: boolean;

  @Column({ name: 'is_spotlight', default: false })
  isSpotlight!: boolean;

  @Column({ name: 'featured_until', type: 'timestamptz', nullable: true })
  featuredUntil?: Date;

  @OneToMany(() => ListingImageEntity, (img) => img.listing, { cascade: true })
  images!: ListingImageEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
