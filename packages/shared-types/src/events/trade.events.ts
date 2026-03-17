import { BaseEvent } from './base.event';
import { RiskLevel, TradeState } from '../enums';

export interface TradeInitiatedEvent extends BaseEvent {
  tradeId: string;
  offerId: string;
  partyAId: string;
  partyBId: string;
  listingAId: string;
  listingBId: string;
  riskLevel: RiskLevel;
  riskScore: number;
}

export interface TradeStateChangedEvent extends BaseEvent {
  tradeId: string;
  fromState: TradeState;
  toState: TradeState;
  riskLevel: RiskLevel;
  triggeredBy: string;
}

export interface TradeLockedEvent extends BaseEvent {
  tradeId: string;
  listingAId: string;
  listingBId: string;
  partyAId: string;
  partyBId: string;
}

export interface TradeProofSubmittedEvent extends BaseEvent {
  tradeId: string;
  userId: string;
  proofPackageId: string;
  packageHash: string;
}

export interface TradeVerifiedEvent extends BaseEvent {
  tradeId: string;
  riskLevel: RiskLevel;
  verifiedBy: string;
  proofHashA: string;
  proofHashB: string;
}

export interface TradeCompletedEvent extends BaseEvent {
  tradeId: string;
  partyAId: string;
  partyBId: string;
  listingAId: string;
  listingBId: string;
  riskLevel: RiskLevel;
  durationMs: number;
}

export interface TradeCancelledEvent extends BaseEvent {
  tradeId: string;
  cancelledBy: string;
  reason: string;
}

export interface TradeDisputeOpenedEvent extends BaseEvent {
  tradeId: string;
  disputeId: string;
  openedBy: string;
  reason: string;
}
