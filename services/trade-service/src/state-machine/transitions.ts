import { TradeState, RiskLevel } from '@exchange/shared-types';
import { TradeEntity } from '../trades/trade.entity';

export interface TransitionDefinition {
  from: TradeState;
  event: string;
  to: TradeState;
  guard?: (trade: TradeEntity, triggeredBy?: string) => boolean;
  guardFailReason?: string;
  sideEffects?: string[];
}

export const TRANSITIONS: TransitionDefinition[] = [
  {
    from: TradeState.INITIATED,
    event: 'offer_made',
    to: TradeState.OFFERED,
    sideEffects: ['notify_listing_owner'],
  },
  {
    from: TradeState.OFFERED,
    event: 'offer_accepted',
    to: TradeState.ACCEPTED,
    sideEffects: ['start_lock_timer'],
  },
  {
    from: TradeState.OFFERED,
    event: 'offer_rejected',
    to: TradeState.CANCELLED,
    sideEffects: ['notify_offerer'],
  },
  {
    from: TradeState.OFFERED,
    event: 'timeout',
    to: TradeState.CANCELLED,
  },
  {
    from: TradeState.ACCEPTED,
    event: 'items_locked',
    to: TradeState.LOCKED,
    sideEffects: ['publish_trade_locked'],
  },
  {
    from: TradeState.ACCEPTED,
    event: 'cancel',
    to: TradeState.CANCELLED,
    guard: (trade: TradeEntity) => {
      if (!trade.lockedAt) return true;
      const lockAge = Date.now() - trade.lockedAt.getTime();
      return lockAge < 60 * 60 * 1000; // within 1 hour
    },
    guardFailReason: 'Cancellation window has expired',
    sideEffects: ['release_locks'],
  },
  {
    from: TradeState.LOCKED,
    event: 'cancel',
    to: TradeState.CANCELLED,
    sideEffects: ['release_locks'],
  },
  {
    from: TradeState.PROOF_SUBMITTED,
    event: 'cancel',
    to: TradeState.CANCELLED,
    sideEffects: ['release_locks'],
  },
  {
    from: TradeState.UNDER_VERIFICATION,
    event: 'cancel',
    to: TradeState.CANCELLED,
    sideEffects: ['release_locks'],
  },
  {
    from: TradeState.LOCKED,
    event: 'proof_submitted',
    to: TradeState.PROOF_SUBMITTED,
    guard: (trade: TradeEntity) => {
      // ALL trades require both parties to submit proof (anti-scam: no exceptions)
      return trade.proofASubmitted && trade.proofBSubmitted;
    },
    guardFailReason: 'Both parties must submit proof',
    sideEffects: ['hash_proof_packages'],
  },
  {
    from: TradeState.PROOF_SUBMITTED,
    event: 'begin_verification',
    to: TradeState.UNDER_VERIFICATION,
    // ALL trades require moderator verification (anti-scam: no auto-verify bypass)
    sideEffects: ['assign_verifier'],
  },
  {
    from: TradeState.UNDER_VERIFICATION,
    event: 'verified',
    to: TradeState.VERIFIED,
    sideEffects: ['generate_certificate', 'set_dispute_window'],
  },
  {
    from: TradeState.UNDER_VERIFICATION,
    event: 'verification_rejected',
    to: TradeState.LOCKED,
    sideEffects: ['request_resubmission'],
  },
  // Cancel from VERIFIED: allowed only if both parties have NOT yet paid
  {
    from: TradeState.VERIFIED,
    event: 'cancel',
    to: TradeState.CANCELLED,
    guard: (trade: TradeEntity) => !(trade.partyAPaid && trade.partyBPaid),
    guardFailReason: 'Cannot cancel after both parties have paid — open a dispute instead',
    sideEffects: ['release_locks'],
  },
  // --- Shipping flow (center-based verification) ---
  {
    from: TradeState.VERIFIED,
    event: 'shipping_ready',
    to: TradeState.SHIPPING_TO_CENTER,
    guard: (trade: TradeEntity) =>
      trade.shippingMethod === 'shipping' &&
      trade.partyAPaid && trade.partyBPaid,
    guardFailReason: 'Shipping method must be set and both parties must have paid',
    sideEffects: ['notify_shipping_to_center'],
  },
  {
    from: TradeState.VERIFIED,
    event: 'local_pickup_confirmed',
    to: TradeState.DELIVERED,
    guard: (trade: TradeEntity) =>
      trade.shippingMethod === 'local_pickup' &&
      trade.partyALocalPickupConfirmed &&
      trade.partyBLocalPickupConfirmed &&
      trade.partyAPaid && trade.partyBPaid,
    guardFailReason: 'Both parties must confirm local pickup and pay the transaction fee',
    sideEffects: ['set_dispute_window'],
  },
  // Leg 1: items shipping to centers
  {
    from: TradeState.SHIPPING_TO_CENTER,
    event: 'all_shipments_in_transit',
    to: TradeState.SHIPPING_TO_CENTER,
    sideEffects: ['notify_leg1_in_transit'],
  },
  {
    from: TradeState.SHIPPING_TO_CENTER,
    event: 'both_items_at_center',
    to: TradeState.AT_CENTER,
    guard: (trade: TradeEntity) =>
      trade.itemAAtCenter && trade.itemBAtCenter,
    guardFailReason: 'Both items must arrive at their verification centers',
    sideEffects: ['notify_at_center'],
  },
  {
    from: TradeState.SHIPPING_TO_CENTER,
    event: 'cancel',
    to: TradeState.CANCELLED,
    sideEffects: ['release_locks', 'cancel_shipments'],
  },
  // Cancel from AT_CENTER: items at center but not yet inspected
  {
    from: TradeState.AT_CENTER,
    event: 'cancel',
    to: TradeState.CANCELLED,
    sideEffects: ['release_locks', 'create_return_shipments'],
  },
  // Center verification
  {
    from: TradeState.AT_CENTER,
    event: 'center_inspection_started',
    to: TradeState.CENTER_VERIFICATION,
    sideEffects: [],
  },
  {
    from: TradeState.CENTER_VERIFICATION,
    event: 'both_items_center_verified',
    to: TradeState.CENTER_VERIFIED,
    guard: (trade: TradeEntity) =>
      trade.itemACenterVerified && trade.itemBCenterVerified,
    guardFailReason: 'Both items must pass center verification',
    sideEffects: ['create_leg2_shipments'],
  },
  {
    from: TradeState.CENTER_VERIFICATION,
    event: 'center_verification_rejected',
    to: TradeState.CANCELLED,
    sideEffects: ['create_return_shipments', 'refund_fees'],
  },
  // Cancel from CENTER_VERIFIED: both items verified but leg 2 not started
  {
    from: TradeState.CENTER_VERIFIED,
    event: 'cancel',
    to: TradeState.CANCELLED,
    sideEffects: ['release_locks', 'create_return_shipments'],
  },
  // Leg 2: items shipping from centers to recipients
  {
    from: TradeState.CENTER_VERIFIED,
    event: 'all_shipments_in_transit',
    to: TradeState.SHIPPING_TO_RECIPIENTS,
    sideEffects: ['notify_shipping_to_recipients'],
  },
  {
    from: TradeState.SHIPPING_TO_RECIPIENTS,
    event: 'all_shipments_delivered',
    to: TradeState.DELIVERED,
    sideEffects: ['set_dispute_window'],
  },
  {
    from: TradeState.SHIPPING_TO_RECIPIENTS,
    event: 'dispute_window_expired',
    to: TradeState.COMPLETED,
    sideEffects: ['publish_trade_completed', 'trigger_ratings'],
  },
  {
    from: TradeState.SHIPPING_TO_RECIPIENTS,
    event: 'dispute_opened',
    to: TradeState.DISPUTE_OPEN,
    sideEffects: ['notify_dispute_service'],
  },
  {
    from: TradeState.DELIVERED,
    event: 'buyer_confirmed_receipt',
    to: TradeState.COMPLETED,
    sideEffects: ['publish_trade_completed', 'trigger_ratings'],
  },
  {
    from: TradeState.DELIVERED,
    event: 'dispute_window_expired',
    to: TradeState.COMPLETED,
    sideEffects: ['publish_trade_completed', 'trigger_ratings'],
  },
  {
    from: TradeState.DELIVERED,
    event: 'dispute_opened',
    to: TradeState.DISPUTE_OPEN,
    guard: (trade: TradeEntity) => {
      if (!trade.disputeWindowEnd) return false;
      return new Date() < trade.disputeWindowEnd;
    },
    guardFailReason: 'Dispute window has expired',
    sideEffects: ['notify_dispute_service'],
  },
  // --- Legacy: direct VERIFIED → COMPLETED for trades without shipping ---
  {
    from: TradeState.VERIFIED,
    event: 'dispute_opened',
    to: TradeState.DISPUTE_OPEN,
    guard: (trade: TradeEntity) => {
      if (!trade.disputeWindowEnd) return false;
      return new Date() < trade.disputeWindowEnd;
    },
    guardFailReason: 'Dispute window has expired',
    sideEffects: ['notify_dispute_service'],
  },
  {
    from: TradeState.VERIFIED,
    event: 'dispute_window_expired',
    to: TradeState.COMPLETED,
    guard: (trade: TradeEntity) => !trade.shippingMethod,
    guardFailReason: 'Shipping method is set — use shipping flow',
    sideEffects: ['publish_trade_completed', 'trigger_ratings'],
  },
  {
    from: TradeState.DISPUTE_OPEN,
    event: 'dispute_resolved',
    to: TradeState.COMPLETED,
    sideEffects: ['apply_resolution'],
  },
  {
    from: TradeState.DISPUTE_OPEN,
    event: 'trade_revoked',
    to: TradeState.REVOKED,
    sideEffects: ['compensate_parties', 'revoke_certificates'],
  },
];
