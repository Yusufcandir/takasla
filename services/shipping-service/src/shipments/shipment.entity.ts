import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ShipmentStatus } from '@exchange/shared-types';
import { ShipmentEventEntity } from './shipment-event.entity';

@Entity('shipments')
export class ShipmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  tradeId!: string;

  @Column()
  senderId!: string;

  @Column()
  recipientId!: string;

  @Column({ nullable: true })
  listingId?: string;

  @Column({ type: 'varchar', default: ShipmentStatus.PENDING })
  status!: ShipmentStatus;

  // Carrier info
  @Column({ nullable: true })
  carrierId?: string;

  @Column({ nullable: true })
  carrierName?: string;

  @Column({ nullable: true })
  carrierCode?: string;

  @Column({ nullable: true })
  serviceLevel?: string;

  @Column({ nullable: true })
  trackingNumber?: string;

  @Column({ nullable: true })
  trackingUrl?: string;

  @Column({ nullable: true })
  labelUrl?: string;

  // Provider references (Geliver, EasyPost, etc.)
  @Column({ nullable: true })
  providerShipmentId?: string;

  @Column({ nullable: true })
  providerTrackerId?: string;

  @Column({ default: 'simulation' })
  providerType!: string; // 'geliver' | 'easypost' | 'simulation'

  @Column({ nullable: true })
  barcode?: string;

  // Sender address
  @Column({ nullable: true })
  senderName?: string;

  @Column({ nullable: true })
  senderStreet?: string;

  @Column({ nullable: true })
  senderCity?: string;

  @Column({ nullable: true })
  senderState?: string;

  @Column({ nullable: true })
  senderPostalCode?: string;

  @Column({ nullable: true })
  senderCountry?: string;

  @Column({ nullable: true })
  senderPhone?: string;

  @Column({ nullable: true })
  senderDistrict?: string;

  @Column({ nullable: true })
  senderEmail?: string;

  @Column({ nullable: true })
  senderCountryCode?: string;

  @Column({ nullable: true })
  senderStateCode?: string;

  @Column({ nullable: true })
  senderCityCode?: string;

  @Column({ nullable: true })
  senderNeighbourhood?: string;

  // Recipient address
  @Column({ nullable: true })
  recipientName?: string;

  @Column({ nullable: true })
  recipientStreet?: string;

  @Column({ nullable: true })
  recipientCity?: string;

  @Column({ nullable: true })
  recipientState?: string;

  @Column({ nullable: true })
  recipientPostalCode?: string;

  @Column({ nullable: true })
  recipientCountry?: string;

  @Column({ nullable: true })
  recipientPhone?: string;

  @Column({ nullable: true })
  recipientDistrict?: string;

  @Column({ nullable: true })
  recipientEmail?: string;

  @Column({ nullable: true })
  recipientCountryCode?: string;

  @Column({ nullable: true })
  recipientStateCode?: string;

  @Column({ nullable: true })
  recipientCityCode?: string;

  @Column({ nullable: true })
  recipientNeighbourhood?: string;

  // Cost
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  cost?: number;

  @Column({ default: 'USD' })
  currency!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  insuranceAmount?: number;

  @Column({ name: 'declared_weight_grams', type: 'int', nullable: true })
  declaredWeightGrams?: number;

  @Column({ name: 'actual_weight_grams', type: 'int', nullable: true })
  actualWeightGrams?: number;

  @Column({ name: 'weight_mismatch_flag', default: false })
  weightMismatchFlag!: boolean;

  @Column({ type: 'timestamp with time zone', nullable: true })
  estimatedDeliveryDate?: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  shippedAt?: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  deliveredAt?: Date;

  // === Verification center leg tracking ===
  @Column({ type: 'varchar', length: 20, default: 'direct' })
  leg!: string; // 'direct' | 'to_center' | 'to_recipient' | 'return'

  @Column({ name: 'center_id', type: 'uuid', nullable: true })
  centerId?: string;

  @Column({ name: 'leg_order', type: 'int', default: 1 })
  legOrder!: number; // 1 = Leg 1 (to center), 2 = Leg 2 (to recipient)

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @OneToMany(() => ShipmentEventEntity, (event) => event.shipment, { cascade: true })
  events!: ShipmentEventEntity[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date;
}
