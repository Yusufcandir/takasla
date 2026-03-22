import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RabbitMQService } from '@exchange/common';
import { QUEUES, ROUTING_KEYS } from '@exchange/shared-types';
import { TradeEntity } from '../trades/trade.entity';

@Injectable()
export class UserCleanupListener implements OnModuleInit {
  private readonly logger = new Logger('TradeUserCleanup');

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    @InjectRepository(TradeEntity)
    private readonly tradeRepo: Repository<TradeEntity>,
  ) {}

  async onModuleInit() {
    await this.rabbitMQService.subscribe(
      QUEUES.TRADE_CLEANUP,
      [ROUTING_KEYS.AUTH.USER_DELETED],
      async (msg) => {
        try {
          const { userId } = msg as { userId: string };
          this.logger.log(`Anonymizing trade-service data for user ${userId}`);

          const DELETED = '[deleted user]';

          // Anonymize user references in trades (keep records for legal compliance)
          await this.tradeRepo
            .createQueryBuilder()
            .update()
            .set({ partyAId: DELETED })
            .where('party_a_id = :userId', { userId })
            .execute();

          await this.tradeRepo
            .createQueryBuilder()
            .update()
            .set({ partyBId: DELETED })
            .where('party_b_id = :userId', { userId })
            .execute();

          this.logger.log(`Trade-service anonymization complete for user ${userId}`);
        } catch (err) {
          this.logger.error('Failed to anonymize trade-service data', err);
        }
      },
    );

    this.logger.log('User cleanup listener subscribed');
  }
}
