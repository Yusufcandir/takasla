import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeEntity } from '../trades/trade.entity';
import { UserCleanupListener } from './user-cleanup.listener';
import { DataRetentionScheduler } from './data-retention.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([TradeEntity])],
  providers: [UserCleanupListener, DataRetentionScheduler],
})
export class CleanupModule {}
