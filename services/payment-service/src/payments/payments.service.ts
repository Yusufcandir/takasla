import { Injectable, Logger, NotFoundException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PaymentEntity } from './payment.entity';
import { QUEUES, ROUTING_KEYS } from '@exchange/shared-types';
import { OutboxService, RabbitMQService } from '@exchange/common';
import { IyzicoService } from '../iyzico/iyzico.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PaymentsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly feePercentage: number;
  private readonly frontendUrl: string;
  private readonly gatewayUrl: string;

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepo: Repository<PaymentEntity>,
    private readonly iyzicoService: IyzicoService,
    private readonly outboxService: OutboxService,
    private readonly dataSource: DataSource,
    private readonly rabbitMQService: RabbitMQService,
    private readonly config: ConfigService,
  ) {
    this.feePercentage = parseFloat(this.config.get<string>('PLATFORM_FEE_PERCENTAGE', '0.025'));
    this.frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:4000');
    this.gatewayUrl = this.config.get<string>('GATEWAY_URL', 'http://api-gateway:3000');
  }

  async onModuleInit() {
    // Single subscribe for all trade events — avoids multiple consumers on the same queue
    await this.rabbitMQService.subscribe(
      QUEUES.PAYMENT_ON_TRADE,
      [ROUTING_KEYS.TRADE.VERIFIED, ROUTING_KEYS.TRADE.CANCELLED, ROUTING_KEYS.TRADE.COMPLETED],
      async (msg: Record<string, unknown>, routingKey: string) => {
        const tradeId = msg.tradeId as string;

        if (routingKey === ROUTING_KEYS.TRADE.VERIFIED) {
          const { partyAId, partyBId, listingAId, listingBId } = msg as {
            partyAId: string;
            partyBId: string;
            listingAId: string;
            listingBId: string;
          };

          this.logger.log(`Trade verified: ${tradeId}, creating payment records`);

          try {
            const [listingA, listingB] = await Promise.all([
              this.fetchListingDetails(listingAId),
              this.fetchListingDetails(listingBId),
            ]);

            const [catFeeA, catFeeB] = await Promise.all([
              listingA.categoryId ? this.fetchCategoryFee(listingA.categoryId) : Promise.resolve({ baseFee: 100.0, feeCurrency: 'TRY' }),
              listingB.categoryId ? this.fetchCategoryFee(listingB.categoryId) : Promise.resolve({ baseFee: 100.0, feeCurrency: 'TRY' }),
            ]);

            await this.createTradePayments(
              tradeId,
              partyAId,
              partyBId,
              catFeeA.baseFee,
              catFeeB.baseFee,
              catFeeA.feeCurrency || 'TRY',
            );
          } catch (err) {
            this.logger.error(`Failed to create payments for trade ${tradeId}: ${err}`);
          }
        } else if (routingKey === ROUTING_KEYS.TRADE.CANCELLED) {
          this.logger.log(`Trade cancelled: ${tradeId}, refunding escrowed payments`);
          try {
            await this.refundTradePayments(tradeId);
          } catch (err) {
            this.logger.error(`Failed to refund payments for trade ${tradeId}: ${err}`);
          }
        } else if (routingKey === ROUTING_KEYS.TRADE.COMPLETED) {
          this.logger.log(`Trade completed: ${tradeId}, releasing escrowed payments`);
          try {
            await this.releaseEscrow(tradeId);
          } catch (err) {
            this.logger.error(`Failed to release escrow for trade ${tradeId}: ${err}`);
          }
        }
      },
    );

    // Listen for dispute.resolved → auto-refund when compensation requires it
    await this.rabbitMQService.subscribe(
      QUEUES.PAYMENT_ON_DISPUTE,
      [ROUTING_KEYS.DISPUTE.RESOLVED],
      async (msg: Record<string, unknown>) => {
        const { tradeId, compensationAction, compensationAmount } = msg as {
          tradeId: string;
          compensationAction?: string;
          compensationAmount?: number;
        };
        if (!tradeId || !compensationAction) return;

        this.logger.log(`Dispute resolved for trade ${tradeId}: ${compensationAction}`);
        try {
          if (compensationAction === 'full_refund') {
            await this.refundTradePayments(tradeId);
          } else if (compensationAction === 'partial_refund' && compensationAmount) {
            await this.partialRefundTradePayments(tradeId, compensationAmount);
          }
        } catch (err) {
          this.logger.error(`Auto-compensation failed for trade ${tradeId}: ${err}`);
        }
      },
    );
  }

  private async fetchListingDetails(listingId: string): Promise<{ declaredValue: number; currency: string; categoryId?: string }> {
    const listingServiceUrl = this.config.get<string>('LISTING_SERVICE_URL', 'http://listing-service:3003');
    const url = `${listingServiceUrl}/listings/${listingId}`;

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to fetch listing ${listingId}: ${res.status}`);
    }
    const data = await res.json() as { declaredValue: string; currency?: string; categoryId?: string };
    return { declaredValue: parseFloat(data.declaredValue), currency: data.currency || 'TRY', categoryId: data.categoryId };
  }

  private async fetchCategoryFee(categoryId: string): Promise<{ baseFee: number; feeCurrency: string }> {
    const listingServiceUrl = this.config.get<string>('LISTING_SERVICE_URL', 'http://listing-service:3003');
    const url = `${listingServiceUrl}/categories/by-id/${categoryId}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        this.logger.warn(`Failed to fetch category ${categoryId}: ${res.status}, using default fee`);
        return { baseFee: 100.0, feeCurrency: 'TRY' };
      }
      const data = await res.json() as { baseFee?: string; feeCurrency?: string };
      return {
        baseFee: data.baseFee ? parseFloat(String(data.baseFee)) : 100.0,
        feeCurrency: data.feeCurrency || 'TRY',
      };
    } catch (err) {
      this.logger.warn(`Error fetching category fee: ${err}, using default fee`);
      return { baseFee: 100.0, feeCurrency: 'TRY' };
    }
  }

  async createTradePayments(
    tradeId: string,
    partyAId: string,
    partyBId: string,
    feeA: number,
    feeB: number,
    currency: string,
  ): Promise<PaymentEntity[]> {
    // Check if payments already exist for this trade (idempotency)
    const existing = await this.paymentRepo.find({ where: { tradeId } });
    if (existing.length > 0) {
      this.logger.log(`Payments already exist for trade ${tradeId}, skipping`);
      return existing;
    }

    const paymentA = this.paymentRepo.create({
      tradeId,
      userId: partyAId,
      type: 'trade_fee',
      amount: feeA,
      currency,
      feePercentage: 0,
      status: 'pending',
      metadata: { feeType: 'category_based' },
    });

    const paymentB = this.paymentRepo.create({
      tradeId,
      userId: partyBId,
      type: 'trade_fee',
      amount: feeB,
      currency,
      feePercentage: 0,
      status: 'pending',
      metadata: { feeType: 'category_based' },
    });

    const saved = await this.paymentRepo.save([paymentA, paymentB]);
    this.logger.log(`Created category-based payments for trade ${tradeId}: A=${feeA} ${currency}, B=${feeB} ${currency}`);
    return saved;
  }

  async findByTrade(tradeId: string): Promise<PaymentEntity[]> {
    return this.paymentRepo.find({
      where: { tradeId },
      order: { createdAt: 'ASC' },
    });
  }

  async findByUser(userId: string): Promise<PaymentEntity[]> {
    return this.paymentRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(paymentId: string): Promise<PaymentEntity> {
    const payment = await this.paymentRepo.findOne({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async createBoostPayment(
    userId: string,
    listingId: string,
    tier: 'featured' | 'spotlight',
    durationDays: number,
    amount: number,
    currency: string,
  ): Promise<PaymentEntity> {
    const payment = this.paymentRepo.create({
      userId,
      type: 'listing_boost',
      amount,
      currency,
      feePercentage: 0,
      status: 'pending',
      metadata: { listingId, tier, durationDays },
    });
    return this.paymentRepo.save(payment);
  }

  async createCheckoutSession(paymentId: string, userId: string): Promise<{ checkoutUrl: string }> {
    const payment = await this.findOne(paymentId);

    if (payment.userId !== userId) {
      throw new ForbiddenException('Not your payment');
    }

    if (payment.status === 'succeeded') {
      throw new ForbiddenException('Payment already completed');
    }

    // iyzico callback URL — the backend endpoint that iyzico will redirect to after payment
    const callbackUrl = `${this.gatewayUrl}/payments/iyzico/callback`;

    const { token, paymentPageUrl } = await this.iyzicoService.createCheckoutForm(payment, callbackUrl);

    payment.providerCheckoutToken = token;
    payment.status = 'processing';
    await this.paymentRepo.save(payment);

    return { checkoutUrl: paymentPageUrl };
  }

  async handleIyzicoCallback(token: string): Promise<{ success: boolean; redirectUrl: string }> {
    // Find the payment by the checkout token
    const payment = await this.paymentRepo.findOne({
      where: { providerCheckoutToken: token },
    });

    if (!payment) {
      this.logger.warn(`No payment found for iyzico token ${token}`);
      return { success: false, redirectUrl: this.frontendUrl };
    }

    if (payment.status === 'succeeded') {
      this.logger.log(`Payment ${payment.id} already succeeded, skipping`);
      return { success: true, redirectUrl: this.getSuccessUrl(payment) };
    }

    try {
      const result = await this.iyzicoService.retrieveCheckoutResult(token);

      if (result.status === 'success') {
        await this.dataSource.transaction(async (manager) => {
          payment.status = 'succeeded';
          payment.providerPaymentId = result.paymentTransactionId;
          payment.paidAt = new Date();
          // Escrow: hold trade payments until trade completes; boost payments release immediately
          payment.escrowStatus = payment.type === 'trade_fee' ? 'held' : 'released';
          if (payment.type !== 'trade_fee') payment.escrowReleasedAt = new Date();
          await manager.save(payment);

          await this.outboxService.addToOutbox(
            manager,
            'payment',
            payment.id,
            ROUTING_KEYS.PAYMENT.SUCCEEDED,
            {
              paymentId: payment.id,
              tradeId: payment.tradeId,
              userId: payment.userId,
              amount: payment.amount,
              currency: payment.currency,
            },
          );

          if (payment.type === 'listing_boost') {
            await this.outboxService.addToOutbox(
              manager,
              'payment',
              payment.id,
              ROUTING_KEYS.PAYMENT.BOOST_SUCCEEDED,
              {
                paymentId: payment.id,
                userId: payment.userId,
                metadata: payment.metadata,
              },
            );
          }
        });

        this.logger.log(`Payment ${payment.id} succeeded via iyzico (type=${payment.type})`);
        return { success: true, redirectUrl: this.getSuccessUrl(payment) };
      } else {
        payment.status = 'failed';
        await this.paymentRepo.save(payment);
        this.logger.warn(`Payment ${payment.id} failed via iyzico: ${result.status}`);
        return { success: false, redirectUrl: this.getCancelUrl(payment) };
      }
    } catch (err) {
      this.logger.error(`Failed to process iyzico callback for payment ${payment.id}: ${err}`);
      return { success: false, redirectUrl: this.getCancelUrl(payment) };
    }
  }

  async handleSimulatedPayment(paymentId: string, userId: string): Promise<void> {
    const payment = await this.findOne(paymentId);

    if (payment.userId !== userId) {
      throw new ForbiddenException('Not your payment');
    }

    if (payment.status === 'succeeded') {
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      payment.status = 'succeeded';
      payment.providerPaymentId = `sim_pi_${uuidv4()}`;
      payment.paidAt = new Date();
      // Escrow: hold trade payments until trade completes; boost payments release immediately
      payment.escrowStatus = payment.type === 'trade_fee' ? 'held' : 'released';
      if (payment.type !== 'trade_fee') payment.escrowReleasedAt = new Date();
      await manager.save(payment);

      await this.outboxService.addToOutbox(
        manager,
        'payment',
        payment.id,
        ROUTING_KEYS.PAYMENT.SUCCEEDED,
        {
          paymentId: payment.id,
          tradeId: payment.tradeId,
          userId: payment.userId,
          amount: payment.amount,
          currency: payment.currency,
        },
      );

      if (payment.type === 'listing_boost') {
        await this.outboxService.addToOutbox(
          manager,
          'payment',
          payment.id,
          ROUTING_KEYS.PAYMENT.BOOST_SUCCEEDED,
          {
            paymentId: payment.id,
            userId: payment.userId,
            metadata: payment.metadata,
          },
        );
      }
    });

    this.logger.log(`Simulated payment ${payment.id} succeeded (type=${payment.type}, escrow=${payment.escrowStatus})`);
  }

  async releaseEscrow(tradeId: string): Promise<void> {
    const payments = await this.paymentRepo.find({ where: { tradeId } });

    for (const payment of payments) {
      if (payment.escrowStatus !== 'held') continue;

      await this.dataSource.transaction(async (manager) => {
        payment.escrowStatus = 'released';
        payment.escrowReleasedAt = new Date();
        await manager.save(payment);

        await this.outboxService.addToOutbox(
          manager,
          'payment',
          payment.id,
          ROUTING_KEYS.PAYMENT.RELEASED,
          {
            paymentId: payment.id,
            tradeId: payment.tradeId,
            userId: payment.userId,
            amount: payment.amount,
            currency: payment.currency,
          },
        );
      });

      this.logger.log(`Escrow released for payment ${payment.id} (trade ${tradeId})`);
    }
  }

  async refundTradePayments(tradeId: string): Promise<void> {
    // Use pessimistic locking to prevent race condition double-refunds
    // (trade.cancelled and dispute.resolved can arrive concurrently)
    await this.dataSource.transaction(async (manager) => {
      const payments = await manager.find(PaymentEntity, {
        where: { tradeId },
        lock: { mode: 'pessimistic_write' },
      });

      for (const payment of payments) {
        if (payment.status !== 'succeeded' || !payment.providerPaymentId) {
          continue;
        }

        try {
          // Skip iyzico refund for simulated payments
          if (!payment.providerPaymentId.startsWith('sim_')) {
            await this.iyzicoService.refund(
              payment.providerPaymentId,
              Number(payment.amount),
              payment.currency,
            );
          }

          payment.status = 'refunded';
          payment.escrowStatus = 'refunded';
          payment.refundedAt = new Date();
          await manager.save(payment);

          await this.outboxService.addToOutbox(
            manager,
            'payment',
            payment.id,
            ROUTING_KEYS.PAYMENT.REFUNDED,
            {
              paymentId: payment.id,
              tradeId: payment.tradeId,
              userId: payment.userId,
              amount: payment.amount,
              currency: payment.currency,
            },
          );

          this.logger.log(`Refunded payment ${payment.id} for trade ${tradeId}`);
        } catch (err) {
          this.logger.error(`Failed to refund payment ${payment.id}: ${err}`);
        }
      }
    });
  }

  async partialRefundTradePayments(tradeId: string, refundAmount: number): Promise<void> {
    const payments = await this.paymentRepo.find({ where: { tradeId } });

    for (const payment of payments) {
      if (payment.status !== 'succeeded' || !payment.providerPaymentId) continue;

      const amountToRefund = Math.min(refundAmount, Number(payment.amount));

      try {
        if (!payment.providerPaymentId.startsWith('sim_')) {
          await this.iyzicoService.refund(
            payment.providerPaymentId,
            amountToRefund,
            payment.currency,
          );
        }

        await this.dataSource.transaction(async (manager) => {
          payment.status = amountToRefund >= Number(payment.amount) ? 'refunded' : 'partial_refund';
          payment.escrowStatus = 'refunded';
          payment.refundedAt = new Date();
          await manager.save(payment);

          await this.outboxService.addToOutbox(
            manager, 'payment', payment.id,
            ROUTING_KEYS.PAYMENT.REFUNDED,
            {
              paymentId: payment.id,
              tradeId: payment.tradeId,
              userId: payment.userId,
              amount: amountToRefund,
              currency: payment.currency,
              partial: true,
            },
          );
        });

        this.logger.log(`Partial refund ${amountToRefund} for payment ${payment.id} (trade ${tradeId})`);
      } catch (err) {
        this.logger.error(`Failed partial refund for payment ${payment.id}: ${err}`);
      }
    }
  }

  private getSuccessUrl(payment: PaymentEntity): string {
    if (payment.type === 'listing_boost' && payment.metadata?.listingId) {
      return `${this.frontendUrl}/listings/${payment.metadata.listingId}?boost=success`;
    }
    return `${this.frontendUrl}/trades/${payment.tradeId}?payment=success`;
  }

  private getCancelUrl(payment: PaymentEntity): string {
    if (payment.type === 'listing_boost' && payment.metadata?.listingId) {
      return `${this.frontendUrl}/listings/${payment.metadata.listingId}?boost=cancelled`;
    }
    return `${this.frontendUrl}/trades/${payment.tradeId}?payment=cancelled`;
  }
}
