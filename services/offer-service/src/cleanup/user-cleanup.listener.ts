import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RabbitMQService } from '@exchange/common';
import { QUEUES, ROUTING_KEYS } from '@exchange/shared-types';
import { OfferEntity } from '../offers/offer.entity';

@Injectable()
export class UserCleanupListener implements OnModuleInit {
  private readonly logger = new Logger('OfferUserCleanup');

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    @InjectRepository(OfferEntity)
    private readonly offerRepo: Repository<OfferEntity>,
  ) {}

  async onModuleInit() {
    await this.rabbitMQService.subscribe(
      QUEUES.OFFER_CLEANUP,
      [ROUTING_KEYS.AUTH.USER_DELETED],
      async (msg) => {
        try {
          const { userId } = msg as { userId: string };
          this.logger.log(`Cleaning up offer-service data for user ${userId}`);

          // Cancel pending offers from this user
          await this.offerRepo.update(
            { offererId: userId, status: 'pending' as any },
            { status: 'cancelled' as any },
          );

          this.logger.log(`Offer-service cleanup complete for user ${userId}`);
        } catch (err) {
          this.logger.error('Failed to clean up offer-service data', err);
        }
      },
    );

    this.logger.log('User cleanup listener subscribed');
  }
}
