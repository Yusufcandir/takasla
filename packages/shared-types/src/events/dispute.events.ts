import { BaseEvent } from './base.event';

export interface DisputeOpenedEvent extends BaseEvent {
  disputeId: string;
  tradeId: string;
  openedBy: string;
  reason: string;
}

export interface DisputeResolvedEvent extends BaseEvent {
  disputeId: string;
  tradeId: string;
  resolution: string;
  resolvedBy: string;
  outcome: 'completed' | 'revoked';
}
