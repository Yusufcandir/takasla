import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentEntity } from '../payments/payment.entity';
import { v4 as uuidv4 } from 'uuid';

// iyzipay uses CommonJS callback-style API
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Iyzipay = require('iyzipay');

@Injectable()
export class IyzicoService {
  private readonly logger = new Logger(IyzicoService.name);
  private readonly iyzipay: InstanceType<typeof Iyzipay> | null;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('IYZICO_API_KEY');
    const secretKey = this.config.get<string>('IYZICO_SECRET_KEY');
    this.baseUrl = this.config.get<string>('IYZICO_BASE_URL', 'https://sandbox-api.iyzipay.com');

    if (apiKey && secretKey) {
      this.iyzipay = new Iyzipay({
        apiKey,
        secretKey,
        uri: this.baseUrl,
      });
      this.logger.log(`iyzico initialized (${this.baseUrl.includes('sandbox') ? 'SANDBOX' : 'LIVE'})`);
    } else {
      this.iyzipay = null;
      this.logger.warn('IYZICO_API_KEY/SECRET_KEY not set — running in simulation mode');
    }
  }

  async createCheckoutForm(
    payment: PaymentEntity,
    callbackUrl: string,
  ): Promise<{ token: string; paymentPageUrl: string }> {
    if (!this.iyzipay) {
      this.logger.warn(`Simulation mode: skipping iyzico checkout for payment ${payment.id}`);
      return {
        token: `sim_token_${payment.id}`,
        paymentPageUrl: `${callbackUrl}${callbackUrl.includes('?') ? '&' : '?'}token=sim_token_${payment.id}`,
      };
    }

    const isBoost = payment.type === 'listing_boost';
    const itemName = isBoost
      ? `Listing Boost: ${(payment.metadata?.tier as string) || 'featured'}`
      : 'Trade Transaction Fee';
    const itemId = isBoost
      ? `boost_${payment.id.substring(0, 8)}`
      : `trade_fee_${payment.id.substring(0, 8)}`;

    const price = Number(payment.amount).toFixed(2);

    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: payment.id,
      price,
      paidPrice: price,
      currency: this.mapCurrency(payment.currency),
      basketId: payment.tradeId || payment.id,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl,
      enabledInstallments: [1],
      buyer: {
        id: payment.userId,
        name: 'Platform',
        surname: 'User',
        identityNumber: '11111111111',
        email: 'user@exchange.com',
        gsmNumber: '+905000000000',
        registrationAddress: 'Turkey',
        city: 'Istanbul',
        country: 'Turkey',
        ip: '127.0.0.1',
      },
      shippingAddress: {
        contactName: 'Platform User',
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Turkey',
      },
      billingAddress: {
        contactName: 'Platform User',
        city: 'Istanbul',
        country: 'Turkey',
        address: 'Turkey',
      },
      basketItems: [
        {
          id: itemId,
          name: itemName,
          category1: isBoost ? 'Boost' : 'Platform Fee',
          itemType: Iyzipay.BASKET_ITEM_TYPE.VIRTUAL,
          price,
        },
      ],
    };

    return new Promise((resolve, reject) => {
      this.iyzipay!.checkoutFormInitialize.create(request, (err: Error | null, result: Record<string, unknown>) => {
        if (err) {
          this.logger.error(`iyzico checkout form error: ${err.message}`);
          return reject(err);
        }
        if (result.status !== 'success') {
          this.logger.error(`iyzico checkout form failed: ${result.errorMessage || JSON.stringify(result)}`);
          return reject(new Error(result.errorMessage as string || 'iyzico checkout initialization failed'));
        }
        this.logger.log(`iyzico checkout form created for payment ${payment.id}, token: ${result.token}`);
        resolve({
          token: result.token as string,
          paymentPageUrl: result.paymentPageUrl as string,
        });
      });
    });
  }

  async retrieveCheckoutResult(token: string): Promise<{
    status: string;
    paymentId: string;
    paidPrice: number;
    currency: string;
    paymentTransactionId: string;
    fraudStatus: number;
  }> {
    if (!this.iyzipay) {
      // Simulation mode
      if (token.startsWith('sim_token_')) {
        return {
          status: 'success',
          paymentId: `sim_pay_${uuidv4().substring(0, 12)}`,
          paidPrice: 0,
          currency: 'TRY',
          paymentTransactionId: `sim_txn_${uuidv4().substring(0, 12)}`,
          fraudStatus: 1,
        };
      }
      throw new Error('Invalid simulation token');
    }

    return new Promise((resolve, reject) => {
      this.iyzipay!.checkoutFormAuth.retrieve(
        { locale: Iyzipay.LOCALE.TR, token },
        (err: Error | null, result: Record<string, unknown>) => {
          if (err) {
            this.logger.error(`iyzico retrieve error: ${err.message}`);
            return reject(err);
          }

          const paymentStatus = result.paymentStatus as string;
          const itemTransactions = result.itemTransactions as Array<Record<string, unknown>> || [];
          const firstTransaction = itemTransactions[0] || {};

          resolve({
            status: result.status as string,
            paymentId: result.paymentId as string,
            paidPrice: Number(result.paidPrice),
            currency: result.currency as string,
            paymentTransactionId: firstTransaction.paymentTransactionId as string || '',
            fraudStatus: result.fraudStatus as number,
          });
        },
      );
    });
  }

  async refund(paymentTransactionId: string, amount: number, currency: string): Promise<boolean> {
    if (!this.iyzipay) {
      this.logger.warn(`Simulation mode: skipping refund for ${paymentTransactionId}`);
      return true;
    }

    return new Promise((resolve, reject) => {
      this.iyzipay!.refund.create(
        {
          locale: Iyzipay.LOCALE.TR,
          conversationId: uuidv4(),
          paymentTransactionId,
          price: amount.toFixed(2),
          currency: this.mapCurrency(currency),
          ip: '127.0.0.1',
        },
        (err: Error | null, result: Record<string, unknown>) => {
          if (err) {
            this.logger.error(`iyzico refund error: ${err.message}`);
            return reject(err);
          }
          if (result.status !== 'success') {
            this.logger.error(`iyzico refund failed: ${result.errorMessage}`);
            return reject(new Error(result.errorMessage as string || 'Refund failed'));
          }
          this.logger.log(`iyzico refund succeeded for ${paymentTransactionId}`);
          resolve(true);
        },
      );
    });
  }

  isConfigured(): boolean {
    return this.iyzipay !== null;
  }

  private mapCurrency(currency: string): string {
    const upper = currency.toUpperCase();
    const map: Record<string, string> = {
      TRY: Iyzipay.CURRENCY.TRY,
      USD: Iyzipay.CURRENCY.USD,
      EUR: Iyzipay.CURRENCY.EUR,
      GBP: Iyzipay.CURRENCY.GBP,
    };
    return map[upper] || Iyzipay.CURRENCY.TRY;
  }
}
