import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not, IsNull } from 'typeorm';
import { TradeEntity } from '../trades/trade.entity';

@Injectable()
export class DataRetentionScheduler {
  private readonly logger = new Logger(DataRetentionScheduler.name);

  constructor(
    @InjectRepository(TradeEntity)
    private readonly tradeRepo: Repository<TradeEntity>,
  ) {}

  /** Monthly: anonymize PII in trades completed more than 2 years ago */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async anonymizeOldTrades(): Promise<void> {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const result = await this.tradeRepo
      .createQueryBuilder()
      .update(TradeEntity)
      .set({
        partyAAddress: () => "'{}'::jsonb",
        partyBAddress: () => "'{}'::jsonb",
      })
      .where('completed_at < :cutoff', { cutoff: twoYearsAgo })
      .andWhere('completed_at IS NOT NULL')
      .andWhere("party_a_address != '{}'::jsonb OR party_b_address != '{}'::jsonb")
      .execute();

    if (result.affected) {
      this.logger.log(`Anonymized addresses in ${result.affected} trades older than 2 years`);
    }
  }
}
