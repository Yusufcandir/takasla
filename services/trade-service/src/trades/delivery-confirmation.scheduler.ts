import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TradesService } from './trades.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { TradeEntity } from './trade.entity';
import { TradeState } from '@exchange/shared-types';

@Injectable()
export class DeliveryConfirmationScheduler {
  private readonly logger = new Logger(DeliveryConfirmationScheduler.name);

  constructor(
    @InjectRepository(TradeEntity)
    private readonly tradeRepo: Repository<TradeEntity>,
    private readonly tradesService: TradesService,
  ) {}

  // Every 15 minutes: auto-complete DELIVERED trades where dispute window expired
  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoCompleteExpiredDeliveries() {
    const now = new Date();

    const expiredTrades = await this.tradeRepo.find({
      where: {
        state: TradeState.DELIVERED,
        disputeWindowEnd: LessThan(now),
      },
    });

    if (expiredTrades.length === 0) return;

    this.logger.log(`Found ${expiredTrades.length} delivered trades past dispute window`);

    for (const trade of expiredTrades) {
      try {
        await this.tradesService.completeTrade(trade.id);
        this.logger.log(`Auto-completed trade ${trade.id} (dispute window expired)`);
      } catch (err) {
        this.logger.error(`Failed to auto-complete trade ${trade.id}: ${err}`);
      }
    }
  }
}
