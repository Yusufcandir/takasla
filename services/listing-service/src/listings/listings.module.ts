import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListingEntity } from './listing.entity';
import { ListingImageEntity } from './listing-image.entity';
import { ListingQuestionEntity } from './listing-question.entity';
import { ListingFavoriteEntity } from './listing-favorite.entity';
import { ListingReportEntity } from './listing-report.entity';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

@Module({
  imports: [TypeOrmModule.forFeature([ListingEntity, ListingImageEntity, ListingQuestionEntity, ListingFavoriteEntity, ListingReportEntity])],
  controllers: [ListingsController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
