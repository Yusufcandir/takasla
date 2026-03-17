import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RatingEntity } from './rating.entity';
import { CompletedTradeEntity } from './completed-trade.entity';
import { RatingsController } from './ratings.controller';
import { RatingsService } from './ratings.service';
import { TrustModule } from '../trust/trust.module';

@Module({
  imports: [TypeOrmModule.forFeature([RatingEntity, CompletedTradeEntity]), TrustModule],
  controllers: [RatingsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
