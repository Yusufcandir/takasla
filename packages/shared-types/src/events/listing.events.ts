import { BaseEvent } from './base.event';

export interface ListingCreatedEvent extends BaseEvent {
  listingId: string;
  userId: string;
  categoryId: string;
  declaredValue: number;
  title: string;
}

export interface ListingLockedEvent extends BaseEvent {
  listingId: string;
  tradeId: string;
  lockedBy: string;
}

export interface ListingUnlockedEvent extends BaseEvent {
  listingId: string;
  tradeId: string;
  reason: string;
}
