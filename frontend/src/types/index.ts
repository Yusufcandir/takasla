export interface Category {
  id: string;
  name: string;
  slug: string;
  riskWeight: number;
  baseFee?: number;
  feeCurrency?: string;
}

export interface ListingImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  sortOrder: number;
  listingId: string;
  aiScore?: number;
}

export interface Listing {
  id: string;
  userId: string;
  categoryId?: string;
  category?: Category;
  title: string;
  description?: string;
  declaredValue?: number;
  currency: string;
  condition?: 'new' | 'like_new' | 'good' | 'fair' | 'poor';
  status: 'active' | 'locked' | 'traded' | 'archived';
  location?: string;
  shippingOption?: 'local_pickup' | 'shipping' | 'both';
  priceFlexibility?: 'fixed' | 'negotiable' | 'offers_only';
  hasOriginalPackaging?: boolean;
  hasPurchaseReceipt?: boolean;
  hasCertificateOfAuthenticity?: boolean;
  minExchangeValue?: number;
  maxExchangeValue?: number;
  preferredCategories?: string[];
  metadata: Record<string, unknown>;
  isFeatured?: boolean;
  isSpotlight?: boolean;
  featuredUntil?: string;
  images?: ListingImage[];
  createdAt: string;
  updatedAt: string;
}

export interface Offer {
  id: string;
  listingId: string;
  offeredListingId: string;
  offererId: string;
  listingOwnerId: string;
  status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired' | 'cancelled';
  message?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProofItem {
  type: string;
  url: string;
  description?: string;
}

export interface Trade {
  id: string;
  offerId: string;
  partyAId: string;
  partyBId: string;
  listingAId: string;
  listingBId: string;
  state:
    | 'INITIATED'
    | 'OFFERED'
    | 'ACCEPTED'
    | 'LOCKED'
    | 'PROOF_SUBMITTED'
    | 'UNDER_VERIFICATION'
    | 'VERIFIED'
    | 'AWAITING_SHIPMENT'
    | 'SHIPPING_TO_CENTER'
    | 'AT_CENTER'
    | 'CENTER_VERIFICATION'
    | 'CENTER_VERIFIED'
    | 'SHIPPING_TO_RECIPIENTS'
    | 'IN_TRANSIT'
    | 'DELIVERED'
    | 'DISPUTE_OPEN'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'REVOKED';
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
  partyAPaid: boolean;
  partyBPaid: boolean;
  partyAInsured: boolean;
  partyBInsured: boolean;
  partyAConfirmedReceipt?: boolean;
  partyBConfirmedReceipt?: boolean;
  centerAId?: string;
  centerBId?: string;
  itemAAtCenter?: boolean;
  itemBAtCenter?: boolean;
  itemACenterVerified?: boolean;
  itemBCenterVerified?: boolean;
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

export interface Certificate {
  id: string;
  tradeId: string;
  certificateId: string;
  proofHash: string;
  ownerUserId: string;
  listingId: string;
  status: 'active' | 'transferred' | 'revoked';
  merkleTreeId?: string;
  leafIndex?: number;
  metadata: Record<string, unknown>;
  issuedAt: string;
  revokedAt?: string;
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
  evidence: Evidence[];
  createdAt: string;
  updatedAt: string;
}

export interface Profile {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  totalTrades: number;
  completedTrades: number;
  createdAt: string;
  updatedAt: string;
}

export interface TrustScore {
  id: string;
  userId: string;
  score: number;
  components?: Record<string, number>;
  riskFlags: string[];
  lastCalculated: string;
  createdAt: string;
}

export interface Rating {
  id: string;
  tradeId: string;
  raterId: string;
  ratedUserId: string;
  score: number;
  comment?: string;
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

export interface ShippingAddress {
  name: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  district?: string;
  neighbourhood?: string;
  email?: string;
  countryCode?: string;
  stateCode?: string;
  cityCode?: string;
}

export interface SavedAddress {
  id: string;
  userId: string;
  label: string;
  isDefault: boolean;
  name: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  district?: string;
  neighbourhood?: string;
  email?: string;
  countryCode?: string;
  stateCode?: string;
  cityCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  tradeId: string;
  userId: string;
  type: string;
  amount: number;
  currency: string;
  feePercentage: number;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'refunded';
  providerCheckoutToken?: string;
  paidAt?: string;
  refundedAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  participant1Id: string;
  participant2Id: string;
  lastMessageContent?: string;
  lastMessageAt?: string;
  participant1Unread: number;
  participant2Unread: number;
  otherUserId?: string;
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
}

export interface ShippingRate {
  id: string;
  carrier: string;
  carrierCode: string;
  service: string;
  serviceLevel: string;
  rate: number;
  currency: string;
  estimatedDays: number;
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
  listingId?: string;
  status: 'PENDING' | 'LABEL_CREATED' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'RETURNED' | 'CANCELLED';
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
  leg?: 'direct' | 'to_center' | 'to_recipient';
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
  email?: string;
  contactName: string;
  isActive: boolean;
  operatingHours?: string;
  createdAt: string;
}

export interface CenterVerification {
  id: string;
  tradeId: string;
  listingId: string;
  centerId: string;
  party: 'A' | 'B';
  status: 'pending' | 'item_received' | 'inspecting' | 'approved' | 'rejected';
  verifiedBy?: string;
  verifiedAt?: string;
  notes?: string;
  photoUrls: string[];
  rejectionReason?: string;
  receivedAt?: string;
  createdAt: string;
  updatedAt: string;
}
