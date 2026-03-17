import { BaseEvent } from './base.event';

export interface PaymentSucceededEvent extends BaseEvent {
  paymentId: string;
  tradeId: string;
  userId: string;
  amount: number;
  currency: string;
}

export interface PaymentRefundedEvent extends BaseEvent {
  paymentId: string;
  tradeId: string;
  userId: string;
  amount: number;
  currency: string;
}
