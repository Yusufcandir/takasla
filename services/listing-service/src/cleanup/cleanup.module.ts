import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListingEntity } from '../listings/listing.entity';
import { ListingFavoriteEntity } from '../listings/listing-favorite.entity';
import { ListingReportEntity } from '../listings/listing-report.entity';
import { ListingQuestionEntity } from '../listings/listing-question.entity';
import { UserCleanupListener } from './user-cleanup.listener';

@Module({
  imports: [TypeOrmModule.forFeature([ListingEntity, ListingFavoriteEntity, ListingReportEntity, ListingQuestionEntity])],
  providers: [UserCleanupListener],
})
export class CleanupModule {}
