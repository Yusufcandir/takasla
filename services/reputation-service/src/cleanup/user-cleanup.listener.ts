import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RabbitMQService } from '@exchange/common';
import { QUEUES, ROUTING_KEYS } from '@exchange/shared-types';
import { RatingEntity } from '../ratings/rating.entity';
import { FraudFlagEntity } from '../fraud/fraud-flag.entity';

@Injectable()
export class UserCleanupListener implements OnModuleInit {
  private readonly logger = new Logger('ReputationUserCleanup');

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    @InjectRepository(RatingEntity)
    private readonly ratingRepo: Repository<RatingEntity>,
    @InjectRepository(FraudFlagEntity)
    private readonly fraudFlagRepo: Repository<FraudFlagEntity>,
  ) {}

  async onModuleInit() {
    await this.rabbitMQService.subscribe(
      QUEUES.REPUTATION_CLEANUP,
      [ROUTING_KEYS.AUTH.USER_DELETED],
      async (msg) => {
        try {
          const { userId } = msg as { userId: string };
          this.logger.log(`Cleaning up reputation-service data for user ${userId}`);

          await this.fraudFlagRepo.delete({ userId });
          // Anonymize ratings (keep for trade integrity)
          const DELETED = '[deleted user]';
          await this.ratingRepo
            .createQueryBuilder()
            .update()
            .set({ raterId: DELETED })
            .where('rater_id = :userId', { userId })
            .execute();

          this.logger.log(`Reputation-service cleanup complete for user ${userId}`);
        } catch (err) {
          this.logger.error('Failed to clean up reputation-service data', err);
        }
      },
    );

    this.logger.log('User cleanup listener subscribed');
  }
}
