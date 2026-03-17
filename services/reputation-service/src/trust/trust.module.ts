import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrustScoreSnapshotEntity } from './trust-score-snapshot.entity';
import { RatingEntity } from '../ratings/rating.entity';
import { TrustScoreService } from './trust-score.service';

@Module({
  imports: [TypeOrmModule.forFeature([TrustScoreSnapshotEntity, RatingEntity])],
  providers: [TrustScoreService],
  exports: [TrustScoreService],
})
export class TrustModule {}
