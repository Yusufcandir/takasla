import { BaseEvent } from './base.event';

export interface OfferCreatedEvent extends BaseEvent {
  offerId: string;
  listingId: string;
  offeredListingId: string;
  offererId: string;
  listingOwnerId: string;
}

export interface OfferAcceptedEvent extends BaseEvent {
  offerId: string;
  listingId: string;
  offeredListingId: string;
  partyAId: string;
  partyBId: string;
}

export interface OfferRejectedEvent extends BaseEvent {
  offerId: string;
  rejectedBy: string;
}
