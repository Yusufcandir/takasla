export const EXCHANGE_NAME = 'exchange.events';
export const EXCHANGE_TYPE = 'topic';

export const ROUTING_KEYS = {
  AUTH: {
    USER_REGISTERED: 'auth.user.registered',
    USER_VERIFIED: 'auth.user.verified',
    USER_DELETED: 'auth.user.deleted',
  },
  LISTING: {
    CREATED: 'listing.created',
    LOCKED: 'listing.locked',
    UNLOCKED: 'listing.unlocked',
    AI_IMAGE_DETECTED: 'listing.fraud.ai_image',
  },
  OFFER: {
    CREATED: 'offer.created',
    ACCEPTED: 'offer.accepted',
    REJECTED: 'offer.rejected',
  },
  TRADE: {
    INITIATED: 'trade.initiated',
    LOCKED: 'trade.locked',
    PROOF_SUBMITTED: 'trade.proof_submitted',
    VERIFIED: 'trade.verified',
    COMPLETED: 'trade.completed',
    CANCELLED: 'trade.cancelled',
    DISPUTE_OPENED: 'trade.dispute_opened',
    DUPLICATE_PROOF_DETECTED: 'trade.fraud.duplicate_proof',
  },
  REPUTATION: {
    SCORE_UPDATED: 'reputation.score.updated',
  },
  DISPUTE: {
    OPENED: 'dispute.opened',
    RESOLVED: 'dispute.resolved',
  },
  CERTIFICATE: {
    ISSUED: 'certificate.issued',
    ANCHORED: 'certificate.anchored',
  },
  SHIPPING: {
    ADDRESSES_READY: 'shipping.addresses_ready',
    LABEL_CREATED: 'shipping.label.created',
    IN_TRANSIT: 'shipping.in_transit',
    DELIVERED: 'shipping.delivered',
    FAILED: 'shipping.failed',
  },
  CENTER: {
    ITEM_RECEIVED: 'center.item_received',
    VERIFICATION_APPROVED: 'center.verification_approved',
    VERIFICATION_REJECTED: 'center.verification_rejected',
    BOTH_VERIFIED: 'center.both_verified',
  },
  PAYMENT: {
    SUCCEEDED: 'payment.succeeded',
    RELEASED: 'payment.escrow.released',
    REFUNDED: 'payment.refunded',
    FAILED: 'payment.failed',
    BOOST_SUCCEEDED: 'payment.boost.succeeded',
  },
  MODERATION: {
    FRAUD_FLAG_REVIEWED: 'moderation.fraud_flag.reviewed',
    LISTING_REPORT_REVIEWED: 'moderation.listing_report.reviewed',
    LISTING_ARCHIVED: 'moderation.listing.archived',
    DISPUTE_RESOLVED: 'moderation.dispute.resolved',
  },
} as const;

export const QUEUES = {
  USER_ON_AUTH: 'user.on-auth-events',
  TRADE_ON_OFFER: 'trade.on-offer-events',
  TRADE_ON_DISPUTE: 'trade.on-dispute-events',
  LISTING_ON_TRADE: 'listing.on-trade-events',
  REPUTATION_ON_TRADE: 'reputation.on-trade-events',
  DISPUTE_ON_TRADE: 'dispute.on-trade-events',
  CERTIFICATE_ON_TRADE: 'cert.on-trade-events',
  SHIPPING_ON_TRADE: 'shipping.on-trade-events',
  TRADE_ON_SHIPPING: 'trade.on-shipping-events',
  PAYMENT_ON_TRADE: 'payment.on-trade-events',
  TRADE_ON_PAYMENT: 'trade.on-payment-events',
  LISTING_ON_PAYMENT: 'listing.on-payment-events',
  PAYMENT_ON_DISPUTE: 'payment.on-dispute-events',
  FRAUD_ON_TRADE: 'fraud.on-trade-proof-events',
  FRAUD_ON_LISTING: 'fraud.on-listing-events',
  TRADE_ON_CENTER: 'trade.on-center-events',
  SHIPPING_ON_CENTER: 'shipping.on-center-events',
  AUTH_ON_MODERATION: 'auth.on-moderation-events',
  USER_CLEANUP: 'user.on-user-deleted',
  LISTING_CLEANUP: 'listing.on-user-deleted',
  OFFER_CLEANUP: 'offer.on-user-deleted',
  TRADE_CLEANUP: 'trade.on-user-deleted',
  REPUTATION_CLEANUP: 'reputation.on-user-deleted',
  DISPUTE_CLEANUP: 'dispute.on-user-deleted',
  SHIPPING_CLEANUP: 'shipping.on-user-deleted',
  PAYMENT_CLEANUP: 'payment.on-user-deleted',
} as const;
