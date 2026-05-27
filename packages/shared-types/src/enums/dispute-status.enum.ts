export enum DisputeStatus {
  OPEN = 'open',
  UNDER_REVIEW = 'under_review',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated',
  CLOSED = 'closed',
}

export enum DisputeReason {
  ITEM_MISMATCH = 'item_mismatch',
  NOT_RECEIVED = 'not_received',
  DAMAGED = 'damaged',
  COUNTERFEIT = 'counterfeit',
  OTHER = 'other',
}

export enum DisputeOutcome {
  BUYER_WINS = 'buyer_wins',
  SELLER_WINS = 'seller_wins',
  SPLIT = 'split',
  ESCALATED = 'escalated',
  SHIP_TO_CENTER = 'ship_to_center',
}

export enum CompensationAction {
  FULL_REFUND = 'full_refund',
  PARTIAL_REFUND = 'partial_refund',
  NO_REFUND = 'no_refund',
  RE_SHIP = 're_ship',
}

export enum AppealStatus {
  NONE = 'none',
  PENDING = 'pending',
  UPHELD = 'upheld',
  OVERTURNED = 'overturned',
}
