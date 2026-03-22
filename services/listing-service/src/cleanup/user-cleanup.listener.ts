import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RabbitMQService } from '@exchange/common';
import { QUEUES, ROUTING_KEYS, ListingStatus } from '@exchange/shared-types';
import { ListingEntity } from '../listings/listing.entity';
import { ListingFavoriteEntity } from '../listings/listing-favorite.entity';
import { ListingReportEntity } from '../listings/listing-report.entity';
import { ListingQuestionEntity } from '../listings/listing-question.entity';

@Injectable()
export class UserCleanupListener implements OnModuleInit {
  private readonly logger = new Logger('ListingUserCleanup');

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    @InjectRepository(ListingEntity)
    private readonly listingRepo: Repository<ListingEntity>,
    @InjectRepository(ListingFavoriteEntity)
    private readonly favoriteRepo: Repository<ListingFavoriteEntity>,
    @InjectRepository(ListingReportEntity)
    private readonly reportRepo: Repository<ListingReportEntity>,
    @InjectRepository(ListingQuestionEntity)
    private readonly questionRepo: Repository<ListingQuestionEntity>,
  ) {}

  async onModuleInit() {
    await this.rabbitMQService.subscribe(
      QUEUES.LISTING_CLEANUP,
      [ROUTING_KEYS.AUTH.USER_DELETED],
      async (msg) => {
        try {
          const { userId } = msg as { userId: string };
          this.logger.log(`Cleaning up listing-service data for user ${userId}`);

          await this.favoriteRepo.delete({ userId });
          await this.reportRepo.delete({ userId });
          await this.questionRepo.delete({ askerId: userId });
          // Archive user's listings instead of deleting (may be referenced by trades)
          await this.listingRepo.update({ userId }, { status: ListingStatus.ARCHIVED });

          this.logger.log(`Listing-service cleanup complete for user ${userId}`);
        } catch (err) {
          this.logger.error('Failed to clean up listing-service data', err);
        }
      },
    );

    this.logger.log('User cleanup listener subscribed');
  }
}
