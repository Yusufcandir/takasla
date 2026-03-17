export interface BaseEvent {
  eventId: string;
  timestamp: string;
  correlationId: string;
  idempotencyKey: string;
}
