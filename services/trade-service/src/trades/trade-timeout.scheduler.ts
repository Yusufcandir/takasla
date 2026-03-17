import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TradesService } from './trades.service';
import { TradeState } from '@exchange/shared-types';

@Injectable()
export class TradeTimeoutScheduler {
  private readonly logger = new Logger(TradeTimeoutScheduler.name);

  constructor(private readonly tradesService: TradesService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleTimeouts(): Promise<void> {
    const timedOut = await this.tradesService.findTimedOutTrades();
    if (timedOut.length === 0) return;

    this.logger.log(`Processing ${timedOut.length} timed-out trade(s)`);

    for (const trade of timedOut) {
      try {
        if (trade.state === TradeState.DELIVERED
            || trade.state === TradeState.SHIPPING_TO_RECIPIENTS) {
          // Items delivered or in transit to recipients → auto-complete
          await this.tradesService.completeTrade(trade.id);
          this.logger.log(`Auto-completed trade ${trade.id} (dispute window expired)`);
        } else if (trade.state === TradeState.VERIFIED && !trade.shippingMethod) {
          // Legacy: no shipping method, dispute window expired → auto-complete
          await this.tradesService.completeTrade(trade.id);
          this.logger.log(`Auto-completed trade ${trade.id} (no shipping, dispute window expired)`);
        } else {
          // All other states (including VERIFIED with shipping method) → cancel on timeout
          await this.tradesService.cancelTrade(trade.id, 'system');
          this.logger.log(`Auto-cancelled trade ${trade.id} (step timeout)`);
        }
      } catch (err) {
        this.logger.error(`Failed to handle timeout for trade ${trade.id}`, err);
      }
    }
  }
}
