import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RabbitMQService } from '@exchange/common';
import { QUEUES, ROUTING_KEYS } from '@exchange/shared-types';
import { PaymentEntity } from '../payments/payment.entity';

@Injectable()
export class UserCleanupListener implements OnModuleInit {
  private readonly logger = new Logger('PaymentUserCleanup');

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepo: Repository<PaymentEntity>,
  ) {}

  async onModuleInit() {
    await this.rabbitMQService.subscribe(
      QUEUES.PAYMENT_CLEANUP,
      [ROUTING_KEYS.AUTH.USER_DELETED],
      async (msg) => {
        try {
          const { userId } = msg as { userId: string };
          this.logger.log(`Anonymizing payment-service data for user ${userId}`);

          const DELETED = '[deleted user]';

          // Anonymize user reference (keep payment records for financial audit)
          await this.paymentRepo
            .createQueryBuilder()
            .update()
            .set({ userId: DELETED })
            .where('user_id = :userId', { userId })
            .execute();

          this.logger.log(`Payment-service anonymization complete for user ${userId}`);
        } catch (err) {
          this.logger.error('Failed to anonymize payment-service data', err);
        }
      },
    );

    this.logger.log('User cleanup listener subscribed');
  }
}
