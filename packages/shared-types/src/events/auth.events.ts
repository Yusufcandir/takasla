import { BaseEvent } from './base.event';

export interface UserRegisteredEvent extends BaseEvent {
  userId: string;
  email: string;
  role: string;
}

export interface UserVerifiedEvent extends BaseEvent {
  userId: string;
}
