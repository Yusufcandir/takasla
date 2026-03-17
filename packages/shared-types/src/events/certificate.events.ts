import { BaseEvent } from './base.event';

export interface CertificateIssuedEvent extends BaseEvent {
  certificateId: string;
  tradeId: string;
  proofHash: string;
  ownerUserId: string;
  listingId: string;
}

export interface CertificateAnchoredEvent extends BaseEvent {
  certificateId: string;
  merkleTreeId: string;
  merkleRoot: string;
  txHash: string;
  network: string;
}
