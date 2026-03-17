import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeLockEntity } from '../trades/trade-lock.entity';
import { LockService } from './lock.service';
import { TimeWindowService } from './time-window.service';
import { RiskModule } from '../risk/risk.module';

@Module({
  imports: [TypeOrmModule.forFeature([TradeLockEntity]), RiskModule],
  providers: [LockService, TimeWindowService],
  exports: [LockService, TimeWindowService],
})
export class EscrowModule {}
