import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FraudFlagEntity } from './fraud-flag.entity';
import { CompletedTradeEntity } from '../ratings/completed-trade.entity';
import { RatingEntity } from '../ratings/rating.entity';
import { FraudDetectionService } from './fraud-detection.service';
import { FraudController } from './fraud.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FraudFlagEntity, CompletedTradeEntity, RatingEntity])],
  controllers: [FraudController],
  providers: [FraudDetectionService],
  exports: [FraudDetectionService],
})
export class FraudModule {}
