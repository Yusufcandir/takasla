import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, VersionColumn } from 'typeorm';
import { TradeState, RiskLevel } from '@exchange/shared-types';

@Entity('trades')
export class TradeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'offer_id', type: 'uuid' })
  offerId!: string;

  @Column({ name: 'party_a_id', type: 'uuid' })
  partyAId!: string;

  @Column({ name: 'party_b_id', type: 'uuid' })
  partyBId!: string;

  @Column({ name: 'listing_a_id', type: 'uuid' })
  listingAId!: string;

  @Column({ name: 'listing_b_id', type: 'uuid' })
  listingBId!: string;

  @Column({ type: 'varchar', length: 30, default: TradeState.INITIATED })
  state!: TradeState;

  @Column({ name: 'risk_level', type: 'varchar', length: 10, default: RiskLevel.LOW })
  riskLevel!: RiskLevel;

  @Column({ name: 'risk_score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  riskScore?: number;

  @Column({ name: 'risk_factors', type: 'jsonb', default: '{}' })
  riskFactors!: Record<string, unknown>;

  @Column({ name: 'current_step', type: 'varchar', length: 50, nullable: true })
  currentStep?: string;

  @Column({ name: 'proof_a_submitted', default: false })
  proofASubmitted!: boolean;

  @Column({ name: 'proof_b_submitted', default: false })
  proofBSubmitted!: boolean;

  @Column({ name: 'locked_at', type: 'timestamptz', nullable: true })
  lockedAt?: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt?: Date;

  @Column({ name: 'dispute_window_end', type: 'timestamptz', nullable: true })
  disputeWindowEnd?: Date;

  @Column({ name: 'timeout_at', type: 'timestamptz', nullable: true })
  timeoutAt?: Date;

  @Column({ name: 'shipping_method', type: 'varchar', length: 20, nullable: true })
  shippingMethod?: string; // 'shipping' | 'local_pickup'

  @Column({ name: 'party_a_address_submitted', default: false })
  partyAAddressSubmitted!: boolean;

  @Column({ name: 'party_b_address_submitted', default: false })
  partyBAddressSubmitted!: boolean;

  @Column({ name: 'party_a_address', type: 'jsonb', nullable: true })
  partyAAddress?: Record<string, string>;

  @Column({ name: 'party_b_address', type: 'jsonb', nullable: true })
  partyBAddress?: Record<string, string>;

  @Column({ name: 'party_a_local_pickup_confirmed', default: false })
  partyALocalPickupConfirmed!: boolean;

  @Column({ name: 'party_b_local_pickup_confirmed', default: false })
  partyBLocalPickupConfirmed!: boolean;

  @Column({ name: 'party_a_paid', default: false })
  partyAPaid!: boolean;

  @Column({ name: 'party_b_paid', default: false })
  partyBPaid!: boolean;

  @Column({ name: 'party_a_confirmed_receipt', default: false })
  partyAConfirmedReceipt!: boolean;

  @Column({ name: 'party_b_confirmed_receipt', default: false })
  partyBConfirmedReceipt!: boolean;

  // === Verification center fields ===
  @Column({ name: 'center_a_id', type: 'uuid', nullable: true })
  centerAId?: string;

  @Column({ name: 'center_b_id', type: 'uuid', nullable: true })
  centerBId?: string;

  @Column({ name: 'item_a_at_center', default: false })
  itemAAtCenter!: boolean;

  @Column({ name: 'item_b_at_center', default: false })
  itemBAtCenter!: boolean;

  @Column({ name: 'item_a_center_verified', default: false })
  itemACenterVerified!: boolean;

  @Column({ name: 'item_b_center_verified', default: false })
  itemBCenterVerified!: boolean;

  @Column({ name: 'saga_id', type: 'uuid', nullable: true })
  sagaId?: string;

  @VersionColumn()
  version!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
