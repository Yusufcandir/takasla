import { BaseEvent } from './base.event';

export interface TrustScoreUpdatedEvent extends BaseEvent {
  userId: string;
  previousScore: number;
  newScore: number;
}
