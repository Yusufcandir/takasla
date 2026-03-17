import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { CarrierProvider, CarrierRate, LabelResult, TrackingEvent, ShippingAddress } from './carrier-provider.interface';
import { createHash } from 'crypto';

// Geliver SDK — ESM-only package, must use native import() to avoid TypeScript converting to require()
let GeliverClient: any;
let verifyWebhookSig: any;
let sdkLoaded = false;

// Use Function constructor to prevent TypeScript from transforming import() to require()
const dynamicImport = new Function('specifier', 'return import(specifier)');

const loadSdk = (async () => {
  try {
    const sdk = await dynamicImport('@geliver/sdk');
    GeliverClient = sdk.GeliverClient || sdk.default?.GeliverClient;
    verifyWebhookSig = sdk.verifyWebhookSignature || sdk.default?.verifyWebhookSignature;
    sdkLoaded = true;
  } catch {
    // SDK not available — will run in unconfigured mode
  }
})();

interface GeliverOffer {
  id: string;
  providerCode?: string;
  providerServiceCode?: string;
  amount?: string;
  amountLocal?: string;
  currency?: string;
  currencyLocal?: string;
  totalAmount?: string;
  totalAmountLocal?: string;
  averageEstimatedTimeHumanReadible?: string;
  isAccepted?: boolean;
  [key: string]: unknown;
}

interface GeliverOffersInfo {
  cheapest?: GeliverOffer;
  fastest?: GeliverOffer;
  list?: GeliverOffer[];
  totalOffersRequested?: number;
  totalOffersCompleted?: number;
}

interface GeliverShipmentResponse {
  id: string;
  offers?: GeliverOffersInfo;
  statusCode?: string;
  status?: string;
  barcode?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  labelURL?: string;
  hasError?: boolean;
  lastErrorMessage?: string;
  lastErrorCode?: string;
  [key: string]: unknown;
}

interface GeliverTransactionResponse {
  id: string;
  isPayed?: boolean;
  shipment?: {
    barcode?: string;
    trackingNumber?: string;
    labelURL?: string;
    trackingUrl?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

@Injectable()
export class GeliverProvider implements CarrierProvider, OnModuleInit {
  readonly name = 'geliver';
  private readonly logger = new Logger(GeliverProvider.name);
  private client: any;
  private readonly isTestMode: boolean;
  private readonly token: string | undefined;

  // Cache sender addresses to avoid re-creating (key: address hash → Geliver address ID)
  private senderAddressCache = new Map<string, string>();

  // Cache shipment data for buyLabel (key: offer ID → { shipmentId, offer })
  private offerCache = new Map<string, { geliverShipmentId: string; offer: GeliverOffer }>();

  constructor() {
    this.token = process.env.GELIVER_TOKEN;
    this.isTestMode = process.env.GELIVER_TEST_MODE === 'true';
  }

  async onModuleInit() {
    // Wait for ESM SDK to finish loading
    await loadSdk;

    if (this.token && GeliverClient) {
      this.client = new GeliverClient({ token: this.token });
      this.logger.log(`Geliver provider initialized (${this.isTestMode ? 'TEST' : 'PRODUCTION'} mode)`);
    } else if (!sdkLoaded) {
      this.logger.warn('Geliver SDK (@geliver/sdk) not available');
    } else if (!GeliverClient) {
      this.logger.warn('Geliver SDK loaded but GeliverClient not found in exports');
    } else {
      this.logger.warn('No GELIVER_TOKEN set — Geliver provider disabled');
    }
  }

  isConfigured(): boolean {
    return !!this.client;
  }

  async getRates(fromAddress: ShippingAddress, toAddress: ShippingAddress): Promise<CarrierRate[]> {
    if (!this.client) {
      this.logger.warn('Geliver not configured — returning simulated rates');
      return this.getSimulatedRates(fromAddress, toAddress);
    }

    try {
      // Get or create sender address in Geliver
      const senderAddressId = await this.getOrCreateSenderAddress(fromAddress);

      // Create shipment to get carrier offers
      const recipientAddr = this.mapToGeliverAddress(toAddress);

      const shipmentPayload: Record<string, unknown> = {
        senderAddressID: senderAddressId,
        recipientAddress: recipientAddr,
        length: '30',
        width: '20',
        height: '15',
        distanceUnit: 'cm',
        weight: '2',
        massUnit: 'kg',
        order: {
          orderNumber: `ORD-${Date.now()}`,
          sourceIdentifier: process.env.PUBLIC_URL || 'https://exchange.local',
          totalAmount: '0',
          totalAmountCurrency: 'TRY',
        },
      };

      this.logger.log(`Creating shipment with payload: ${JSON.stringify(shipmentPayload, null, 2)}`);

      const createFn = this.isTestMode
        ? this.client.shipments.createTest.bind(this.client.shipments)
        : this.client.shipments.create.bind(this.client.shipments);

      const shipment: GeliverShipmentResponse = await createFn(shipmentPayload);

      // Check for shipment-level errors
      if (shipment.hasError) {
        this.logger.error(`Geliver shipment error: ${shipment.lastErrorMessage} (${shipment.lastErrorCode})`);
        throw new Error(shipment.lastErrorMessage || 'Shipment creation failed');
      }

      // Get offers list from nested structure
      const offersList = shipment.offers?.list || [];

      this.logger.log(`Got ${offersList.length} offers from Geliver (statusCode: ${shipment.statusCode})`);

      if (offersList.length === 0) {
        this.logger.warn('No carrier offers returned from Geliver');
        return [];
      }

      // Cache offers for later label purchase
      const rates: CarrierRate[] = [];
      for (const offer of offersList) {
        const rateId = `geliver_${offer.id}`;
        this.offerCache.set(rateId, {
          geliverShipmentId: shipment.id,
          offer,
        });

        // Parse estimated days from human-readable string like "01 gün 00 saat"
        const estimatedDays = this.parseEstimatedDays(offer.averageEstimatedTimeHumanReadible);

        // Map provider code to a friendly carrier name
        const carrierName = this.mapProviderCodeToName(offer.providerCode || '');
        const serviceName = this.mapServiceCodeToName(offer.providerServiceCode || '', carrierName);

        rates.push({
          id: rateId,
          carrier: carrierName,
          carrierCode: (offer.providerCode || 'unknown').toLowerCase(),
          service: serviceName,
          serviceLevel: (offer.providerServiceCode || 'standard').toLowerCase(),
          rate: parseFloat(offer.amountLocal || offer.amount || '0'),
          currency: offer.currencyLocal || offer.currency || 'TRY',
          estimatedDays,
        });
      }

      this.logger.log(`Got ${rates.length} carrier offers for shipment ${shipment.id}`);
      return rates.sort((a, b) => a.rate - b.rate);
    } catch (error: any) {
      this.logGeliverError('Failed to get rates from Geliver', error);
      // Fall back to simulated rates when API fails (e.g., invalid district names for center addresses)
      this.logger.warn('Falling back to simulated rates due to Geliver API error');
      return this.getSimulatedRates(fromAddress, toAddress);
    }
  }

  async buyLabel(rateId: string): Promise<LabelResult> {
    // Simulated rate IDs bypass the real API entirely
    if (rateId.startsWith('geliver_sim_')) {
      this.logger.log('Buying simulated label for simulated rate');
      return this.getSimulatedLabel(rateId);
    }

    if (!this.client) {
      this.logger.warn('Geliver not configured — returning simulated label');
      return this.getSimulatedLabel(rateId);
    }

    const cached = this.offerCache.get(rateId);
    if (!cached) {
      throw new Error('Rate offer expired or not found. Please get rates again.');
    }

    try {
      const transaction: GeliverTransactionResponse = await this.client.transactions.acceptOffer(cached.offer.id);

      // Clean up cache
      this.offerCache.delete(rateId);

      this.logger.log(`Transaction response: ${JSON.stringify(transaction, null, 2)}`);

      const shipmentData = transaction.shipment || {};
      const carrierCode = (cached.offer.providerCode || 'unknown').toLowerCase();
      const carrier = this.mapProviderCodeToName(cached.offer.providerCode || '');

      const trackingUrl = shipmentData.trackingUrl
        || this.getCarrierTrackingUrl(carrierCode, shipmentData.trackingNumber || '');

      const estimatedDays = this.parseEstimatedDays(cached.offer.averageEstimatedTimeHumanReadible);

      return {
        trackingNumber: shipmentData.trackingNumber || shipmentData.barcode || '',
        trackingUrl,
        labelUrl: shipmentData.labelURL || '',
        barcode: shipmentData.barcode,
        carrier,
        carrierCode,
        service: this.mapServiceCodeToName(cached.offer.providerServiceCode || '', carrier),
        cost: parseFloat(cached.offer.amountLocal || cached.offer.amount || '0'),
        currency: cached.offer.currencyLocal || cached.offer.currency || 'TRY',
        estimatedDeliveryDate: new Date(Date.now() + estimatedDays * 24 * 60 * 60 * 1000),
        providerShipmentId: cached.geliverShipmentId,
        providerTrackerId: cached.geliverShipmentId,
      };
    } catch (error: any) {
      this.logGeliverError('Failed to purchase label via Geliver', error);
      // Fall back to simulated label when API fails
      this.logger.warn('Falling back to simulated label due to Geliver API error');
      return this.getSimulatedLabel(rateId);
    }
  }

  async getTracking(trackerId: string): Promise<TrackingEvent[]> {
    if (!this.client) {
      return [{
        status: 'IN_TRANSIT',
        message: 'Simulated: Package is in transit',
        location: 'Istanbul',
        occurredAt: new Date(),
      }];
    }

    try {
      const shipment = await this.client.shipments.get(trackerId);
      const events: TrackingEvent[] = [];

      this.logger.debug(`Geliver shipment ${trackerId} status: ${shipment.status}, statusCode: ${shipment.statusCode}`);

      // Try to extract tracking events array if available
      const trackingEvents = shipment.trackingEvents || shipment.tracking_events || shipment.events || [];
      if (Array.isArray(trackingEvents) && trackingEvents.length > 0) {
        for (const te of trackingEvents) {
          events.push({
            status: this.mapGeliverStatus(te.status || te.statusCode || ''),
            message: te.message || te.description || `Status: ${te.status || te.statusCode}`,
            location: te.location || te.city || '',
            occurredAt: new Date(te.occurredAt || te.createdAt || te.date || Date.now()),
          });
        }
      }

      // Always include current overall status as the latest event
      if (shipment.status || shipment.statusCode) {
        const currentStatus = this.mapGeliverStatus(shipment.status || shipment.statusCode || '');
        // Only add if not already in events list
        const alreadyExists = events.some(e => e.status === currentStatus);
        if (!alreadyExists) {
          events.push({
            status: currentStatus,
            message: `Status: ${shipment.status || shipment.statusCode}`,
            location: '',
            occurredAt: new Date(shipment.updatedAt || Date.now()),
          });
        }
      }

      return events;
    } catch (error: any) {
      this.logGeliverError('Failed to get tracking from Geliver', error);
      return [];
    }
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (verifyWebhookSig) {
      try {
        return verifyWebhookSig(payload, { 'x-geliver-signature': signature }, { enableVerification: true });
      } catch {
        return false;
      }
    }
    return true;
  }

  // --- Private helpers ---

  private logGeliverError(context: string, error: any) {
    this.logger.error(`${context}: ${error?.message || error}`);
    if (error?.status) this.logger.error(`  HTTP Status: ${error.status}`);
    if (error?.code) this.logger.error(`  Error Code: ${error.code}`);
    if (error?.additionalMessage) this.logger.error(`  Additional: ${error.additionalMessage}`);
    if (error?.responseBody) {
      this.logger.error(`  Response Body: ${JSON.stringify(error.responseBody, null, 2)}`);
    }
  }

  private async getOrCreateSenderAddress(address: ShippingAddress): Promise<string> {
    const hash = this.hashAddress(address);
    const cached = this.senderAddressCache.get(hash);
    if (cached) return cached;

    const senderPayload = this.mapToGeliverAddress(address);
    this.logger.log(`Creating sender address: ${JSON.stringify(senderPayload, null, 2)}`);

    try {
      const sender = await this.client.addresses.createSender(senderPayload);

      this.logger.log(`Sender address response: ${JSON.stringify(sender, null, 2)}`);

      const addressId = sender.id || sender.ID;
      this.senderAddressCache.set(hash, addressId);
      this.logger.log(`Created Geliver sender address: ${addressId}`);
      return addressId;
    } catch (error: any) {
      this.logGeliverError('Failed to create sender address', error);
      throw error;
    }
  }

  private mapToGeliverAddress(address: ShippingAddress): Record<string, string> {
    const city = address.city.trim();
    const countryCode = address.countryCode || this.mapCountryCode(address.country);
    const cityCode = address.cityCode || this.guessCityCode(city);
    const district = (address.district || address.city).trim();
    const phone = this.normalizePhone(address.phone);
    const zip = address.postalCode?.trim() || (countryCode === 'TR' ? `${cityCode}000` : '00000');

    // Prepend neighbourhood to street address if available (e.g., "Kötekli Mah., Atatürk Cad. No:5")
    let street = address.street.trim();
    if (address.neighbourhood) {
      street = `${address.neighbourhood} Mah., ${street}`;
    }

    return {
      name: address.name.trim(),
      email: address.email?.trim() || 'noreply@exchange.local',
      phone,
      address1: street,
      countryCode,
      cityName: city,
      cityCode,
      districtName: district,
      zip,
    };
  }

  private normalizePhone(phone: string): string {
    if (!phone || phone.trim().length === 0) {
      return '+905000000000';
    }
    // Remove all non-digit characters except leading +
    let cleaned = phone.replace(/[^\d+]/g, '');
    // Strip leading + to work with digits only
    if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
    // Remove leading 00 (international prefix)
    if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
    // Strip country code 90 if present to get the local number
    if (cleaned.startsWith('90') && cleaned.length > 2) {
      const rest = cleaned.substring(2);
      // 905XXXXXXXXX → rest = 5XXXXXXXXX (10 digits) — valid
      // 90 alone or 90X (too short) — not a real number
      if (rest.startsWith('5') && rest.length === 10) {
        return '+90' + rest;
      }
      if (rest.startsWith('0') && rest.length === 11) {
        return '+90' + rest.substring(1);
      }
      // rest is too short or doesn't look like a Turkish mobile — try using it raw
      if (rest.length >= 10) {
        return '+90' + rest;
      }
    }
    // 05XXXXXXXXX (11 digits starting with 0)
    if (cleaned.startsWith('0') && cleaned.length === 11) {
      return '+90' + cleaned.substring(1);
    }
    // 5XXXXXXXXX (10 digits starting with 5)
    if (cleaned.startsWith('5') && cleaned.length === 10) {
      return '+90' + cleaned;
    }
    // Already a full international number (12+ digits)
    if (cleaned.length >= 12) {
      return '+' + cleaned;
    }
    // Too short to be a valid phone — use placeholder
    return '+905000000000';
  }

  private mapCountryCode(country: string): string {
    const c = country.toLowerCase().trim();
    if (['turkey', 'türkiye', 'turkiye', 'tr'].includes(c)) return 'TR';
    if (c.length === 2) return c.toUpperCase();
    const map: Record<string, string> = {
      'united states': 'US', 'usa': 'US', 'united kingdom': 'GB', 'uk': 'GB',
      'germany': 'DE', 'france': 'FR', 'italy': 'IT', 'spain': 'ES',
      'netherlands': 'NL', 'belgium': 'BE', 'austria': 'AT', 'switzerland': 'CH',
      'sweden': 'SE', 'norway': 'NO', 'denmark': 'DK', 'finland': 'FI',
      'greece': 'GR', 'poland': 'PL', 'czech republic': 'CZ', 'romania': 'RO',
      'bulgaria': 'BG', 'hungary': 'HU', 'portugal': 'PT', 'ireland': 'IE',
      'japan': 'JP', 'china': 'CN', 'south korea': 'KR', 'australia': 'AU',
      'canada': 'CA', 'brazil': 'BR', 'russia': 'RU', 'india': 'IN',
    };
    return map[c] || country.substring(0, 2).toUpperCase();
  }

  // Turkish city plate codes (used by Geliver)
  private guessCityCode(cityName: string): string {
    // Normalize Turkish characters for matching
    const city = cityName.toLowerCase().trim()
      .replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ş/g, 's')
      .replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i')
      .replace(/İ/g, 'i').replace(/Ü/g, 'u').replace(/Ö/g, 'o')
      .replace(/Ş/g, 's').replace(/Ç/g, 'c').replace(/Ğ/g, 'g');

    const codes: Record<string, string> = {
      'adana': '01', 'adiyaman': '02', 'afyon': '03', 'afyonkarahisar': '03',
      'agri': '04', 'amasya': '05', 'ankara': '06', 'antalya': '07',
      'artvin': '08', 'aydin': '09', 'balikesir': '10', 'bilecik': '11',
      'bingol': '12', 'bitlis': '13', 'bolu': '14', 'burdur': '15',
      'bursa': '16', 'canakkale': '17', 'cankiri': '18', 'corum': '19',
      'denizli': '20', 'diyarbakir': '21', 'edirne': '22', 'elazig': '23',
      'erzincan': '24', 'erzurum': '25', 'eskisehir': '26', 'gaziantep': '27',
      'giresun': '28', 'gumushane': '29', 'hakkari': '30', 'hatay': '31',
      'isparta': '32', 'mersin': '33', 'icel': '33', 'istanbul': '34',
      'izmir': '35', 'kars': '36', 'kastamonu': '37', 'kayseri': '38',
      'kirklareli': '39', 'kirsehir': '40', 'kocaeli': '41', 'konya': '42',
      'kutahya': '43', 'malatya': '44', 'manisa': '45', 'kahramanmaras': '46',
      'mardin': '47', 'mugla': '48', 'mus': '49', 'nevsehir': '50',
      'nigde': '51', 'ordu': '52', 'rize': '53', 'sakarya': '54',
      'samsun': '55', 'siirt': '56', 'sinop': '57', 'sivas': '58',
      'tekirdag': '59', 'tokat': '60', 'trabzon': '61', 'tunceli': '62',
      'sanliurfa': '63', 'usak': '64', 'van': '65', 'yozgat': '66',
      'zonguldak': '67', 'aksaray': '68', 'bayburt': '69', 'karaman': '70',
      'kirikkale': '71', 'batman': '72', 'sirnak': '73', 'bartin': '74',
      'ardahan': '75', 'igdir': '76', 'yalova': '77', 'karabuk': '78',
      'kilis': '79', 'osmaniye': '80', 'duzce': '81',
    };
    return codes[city] || '34'; // Default to Istanbul
  }

  private parseEstimatedDays(humanReadable?: string): number {
    if (!humanReadable) return 3;
    // Format: "01 gün 00 saat" or "02 gün 12 saat"
    const match = humanReadable.match(/(\d+)\s*gün/i);
    if (match) {
      const days = parseInt(match[1], 10);
      return days > 0 ? days : 1;
    }
    return 3;
  }

  private mapProviderCodeToName(providerCode: string): string {
    const names: Record<string, string> = {
      'YURTICI': 'Yurtiçi Kargo',
      'YURTICI_KARGO': 'Yurtiçi Kargo',
      'ARAS': 'Aras Kargo',
      'ARAS_KARGO': 'Aras Kargo',
      'MNG': 'MNG Kargo',
      'MNG_KARGO': 'MNG Kargo',
      'PTT': 'PTT Kargo',
      'PTT_KARGO': 'PTT Kargo',
      'SURAT': 'Sürat Kargo',
      'SURAT_KARGO': 'Sürat Kargo',
      'SURATKARGO': 'Sürat Kargo',
      'HEPSIJET': 'HepsiJet',
      'KOLAYGELSIN': 'Kolay Gelsin',
      'KOLAY_GELSIN': 'Kolay Gelsin',
      'GELIVER': 'Geliver',
      'FEDEX': 'FedEx',
      'UPS': 'UPS',
      'DHL': 'DHL',
    };
    return names[providerCode.toUpperCase()] || providerCode;
  }

  private mapServiceCodeToName(serviceCode: string, carrierName: string): string {
    const names: Record<string, string> = {
      'YURTICI_STANDART': 'Yurtiçi Standart',
      'ARAS_STANDART': 'Aras Standart',
      'MNG_STANDART': 'MNG Standart',
      'PTT_STANDART': 'PTT Standart',
      'SURAT_STANDART': 'Sürat Standart',
      'HEPSIJET_STANDART': 'HepsiJet Standart',
      'KOLAYGELSIN_STANDART': 'Kolay Gelsin Standart',
      'GELIVER_STANDART': 'Geliver Standart',
    };
    return names[serviceCode.toUpperCase()] || `${carrierName} Standard`;
  }

  private mapGeliverStatus(status: string): string {
    const s = status.toLowerCase();
    if (s.includes('deliver') || s.includes('teslim')) return 'DELIVERED';
    if (s.includes('transit') || s.includes('tasima') || s.includes('yolda')) return 'IN_TRANSIT';
    if (s.includes('out_for') || s.includes('dagitim')) return 'OUT_FOR_DELIVERY';
    if (s.includes('label') || s.includes('created') || s.includes('olusturuldu')) return 'LABEL_CREATED';
    if (s.includes('return') || s.includes('iade')) return 'RETURNED';
    if (s.includes('fail') || s.includes('hata')) return 'FAILED';
    if (s.includes('cancel') || s.includes('iptal')) return 'CANCELLED';
    return 'IN_TRANSIT';
  }

  private getCarrierTrackingUrl(carrierCode: string, trackingNumber: string): string {
    const urls: Record<string, string> = {
      yurtici: `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${trackingNumber}`,
      aras: `https://www.araskargo.com.tr/trs_gonderi_sorgula.aspx?p_kod=${trackingNumber}`,
      mng: `https://www.mngkargo.com.tr/gonderi-takip/?code=${trackingNumber}`,
      ptt: `https://gonderitakip.ptt.gov.tr/Track/Verify?q=${trackingNumber}`,
      suratkargo: `https://www.suratkargo.com.tr/gonderi-takip?kod=${trackingNumber}`,
      surat: `https://www.suratkargo.com.tr/gonderi-takip?kod=${trackingNumber}`,
      hepsijet: `https://www.hepsijet.com/gonderi-takip?no=${trackingNumber}`,
      kolaygelsin: `https://www.kolaygelsin.com/gonderi-takip?barcode=${trackingNumber}`,
    };
    return urls[carrierCode] || `https://www.google.com/search?q=${carrierCode}+tracking+${trackingNumber}`;
  }

  private hashAddress(addr: ShippingAddress): string {
    return createHash('md5')
      .update(`${addr.name}|${addr.street}|${addr.city}|${addr.postalCode}|${addr.country}|${addr.phone}`)
      .digest('hex');
  }

  // --- Simulation mode (when GELIVER_TOKEN is not configured) ---

  private getSimulatedRates(_fromAddress: ShippingAddress, _toAddress: ShippingAddress): CarrierRate[] {
    const carriers = [
      { code: 'yurtici', name: 'Yurtiçi Kargo', service: 'Yurtiçi Standart', rate: 89.90, days: 2 },
      { code: 'aras', name: 'Aras Kargo', service: 'Aras Standart', rate: 79.50, days: 3 },
      { code: 'mng', name: 'MNG Kargo', service: 'MNG Standart', rate: 84.00, days: 2 },
      { code: 'ptt', name: 'PTT Kargo', service: 'PTT Standart', rate: 65.00, days: 4 },
    ];

    return carriers.map((c, i) => ({
      id: `geliver_sim_${c.code}_${Date.now()}_${i}`,
      carrier: c.name,
      carrierCode: c.code,
      service: c.service,
      serviceLevel: 'standard',
      rate: c.rate,
      currency: 'TRY',
      estimatedDays: c.days,
    }));
  }

  private getSimulatedLabel(rateId: string): LabelResult {
    // Extract carrier code from rate ID (geliver_sim_yurtici_xxx_0)
    const parts = rateId.split('_');
    const carrierCode = parts[2] || 'yurtici';
    const carrierName = this.mapProviderCodeToName(carrierCode.toUpperCase());
    const trackingNumber = `SIM${Date.now()}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    return {
      trackingNumber,
      trackingUrl: this.getCarrierTrackingUrl(carrierCode, trackingNumber),
      labelUrl: '',
      barcode: trackingNumber,
      carrier: carrierName,
      carrierCode,
      service: `${carrierName} Standard`,
      cost: 79.50,
      currency: 'TRY',
      estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      providerShipmentId: `sim_shipment_${Date.now()}`,
      providerTrackerId: `sim_tracker_${Date.now()}`,
    };
  }
}
