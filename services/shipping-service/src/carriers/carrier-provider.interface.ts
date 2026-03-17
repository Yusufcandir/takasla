export interface CarrierRate {
  id: string;
  carrier: string;
  carrierCode: string;
  service: string;
  serviceLevel: string;
  rate: number;
  currency: string;
  estimatedDays: number;
}

export interface LabelResult {
  trackingNumber: string;
  trackingUrl: string;
  labelUrl: string;
  barcode?: string;
  carrier: string;
  carrierCode: string;
  service: string;
  cost: number;
  currency: string;
  estimatedDeliveryDate: Date;
  providerShipmentId: string;
  providerTrackerId: string;
}

export interface TrackingEvent {
  status: string;
  message: string;
  location: string;
  occurredAt: Date;
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
  email?: string;
  countryCode?: string;
  stateCode?: string;
  cityCode?: string;
  neighbourhood?: string;
}

export interface CarrierProvider {
  readonly name: string;
  isConfigured(): boolean;
  getRates(fromAddress: ShippingAddress, toAddress: ShippingAddress): Promise<CarrierRate[]>;
  buyLabel(rateId: string, shipmentContext?: Record<string, unknown>): Promise<LabelResult>;
  getTracking(trackerId: string): Promise<TrackingEvent[]>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
}

export function isTurkish(country: string): boolean {
  const c = country.toLowerCase().trim();
  return ['turkey', 'türkiye', 'turkiye', 'tr'].includes(c);
}
