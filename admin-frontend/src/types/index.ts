export interface Trade {
  id: string;
  offerId: string;
  partyAId: string;
  partyBId: string;
  listingAId: string;
  listingBId: string;
  state:
    | 'INITIATED' | 'OFFERED' | 'ACCEPTED' | 'LOCKED'
    | 'PROOF_SUBMITTED' | 'UNDER_VERIFICATION' | 'VERIFIED'
    | 'AWAITING_SHIPMENT' | 'IN_TRANSIT' | 'DELIVERED'
    | 'SHIPPING_TO_CENTER' | 'AT_CENTER' | 'CENTER_VERIFICATION'
    | 'CENTER_VERIFIED' | 'SHIPPING_TO_RECIPIENTS'
    | 'DISPUTE_OPEN' | 'COMPLETED' | 'CANCELLED' | 'REVOKED';
  centerAId?: string;
  centerBId?: string;
  itemAAtCenter?: boolean;
  itemBAtCenter?: boolean;
  itemACenterVerified?: boolean;
  itemBCenterVerified?: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore?: number;
  riskFactors: Record<string, unknown>;
  proofASubmitted: boolean;
  proofBSubmitted: boolean;
  lockedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  disputeWindowEnd?: string;
  timeoutAt?: string;
  shippingMethod?: 'shipping' | 'local_pickup';
  partyAAddressSubmitted: boolean;
  partyBAddressSubmitted: boolean;
  partyALocalPickupConfirmed: boolean;
  partyBLocalPickupConfirmed: boolean;
  availableActions?: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface TradeEvent {
  id: string;
  tradeId: string;
  eventType: string;
  fromState?: string;
  toState?: string;
  payload: Record<string, unknown>;
  triggeredBy?: string;
  createdAt: string;
}

export interface ListingImage {
  id: string;
  url: string;
  sortOrder: number;
  listingId: string;
}

export interface Listing {
  id: string;
  userId: string;
  categoryId?: string;
  title: string;
  description?: string;
  declaredValue?: number;
  currency: string;
  category?: { id: string; name: string; slug: string; baseFee?: number };
  condition?: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  status: 'active' | 'locked' | 'traded' | 'archived';
  location?: string;
  images?: ListingImage[];
  createdAt: string;
  updatedAt: string;
}

export interface Evidence {
  id: string;
  disputeId: string;
  uploadedBy: string;
  type: 'photo' | 'video' | 'document' | 'text';
  url: string;
  description?: string;
  fileHash?: string;
  createdAt: string;
}

export interface Dispute {
  id: string;
  tradeId: string;
  openedBy: string;
  reason: 'item_mismatch' | 'not_received' | 'damaged' | 'counterfeit' | 'other';
  description?: string;
  status: 'open' | 'under_review' | 'resolved' | 'escalated' | 'closed';
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  outcomeType?: 'buyer_wins' | 'seller_wins' | 'split' | 'escalated';
  compensationAction?: 'full_refund' | 'partial_refund' | 'no_refund' | 're_ship';
  compensationAmount?: number;
  appealStatus?: 'none' | 'pending' | 'upheld' | 'overturned';
  appealedBy?: string;
  appealReason?: string;
  appealDeadline?: string;
  slaDeadline?: string;
  escalatedAt?: string;
  evidence: Evidence[];
  createdAt: string;
  updatedAt: string;
}

export interface FraudFlag {
  id: string;
  userId: string;
  flagType: string;
  description?: string;
  evidence: Record<string, unknown>;
  relatedUserId?: string;
  reviewed: boolean;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
}

export interface ProofPackageItem {
  type: string;
  url: string;
  hash: string;
}

export interface ProofPackage {
  id: string;
  tradeId: string;
  userId: string;
  items: ProofPackageItem[];
  packageHash?: string;
  submittedAt: string;
}

export interface UserSummary {
  id: string;
  email: string;
  role: string;
  isVerified: boolean;
  createdAt: string;
}

export interface ShipmentEvent {
  id: string;
  shipmentId: string;
  status: string;
  message: string;
  location: string;
  occurredAt: string;
  createdAt: string;
}

export interface Shipment {
  id: string;
  tradeId: string;
  senderId: string;
  recipientId: string;
  status: string;
  carrierName?: string;
  carrierCode?: string;
  serviceLevel?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  labelUrl?: string;
  barcode?: string;
  providerType?: string;
  cost?: number;
  currency: string;
  estimatedDeliveryDate?: string;
  shippedAt?: string;
  deliveredAt?: string;
  leg?: string;
  centerId?: string;
  legOrder?: number;
  events: ShipmentEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface VerificationCenter {
  id: string;
  name: string;
  code: string;
  city: string;
  district: string;
  street: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  contactName: string;
  isActive: boolean;
  operatingHours: string;
  createdAt: string;
}

export interface ListingReport {
  id: string;
  listingId: string;
  userId: string;
  reason: 'inappropriate_content' | 'fraud_scam' | 'wrong_category' | 'duplicate' | 'prohibited_item' | 'other';
  description?: string;
  status: 'pending' | 'reviewed' | 'dismissed';
  reviewedBy?: string;
  adminNotes?: string;
  listing?: Listing;
  createdAt: string;
  updatedAt: string;
}

export interface CenterVerification {
  id: string;
  tradeId: string;
  listingId: string;
  centerId: string;
  party: string;
  status: 'pending' | 'item_received' | 'inspecting' | 'approved' | 'rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  photoUrls?: string[];
  rejectionReason?: string;
  receivedAt?: string;
  createdAt: string;
  updatedAt: string;
}
