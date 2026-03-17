import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrustScoreEntity } from './trust-score.entity';
import { TrustService } from './trust.service';

@Module({
  imports: [TypeOrmModule.forFeature([TrustScoreEntity])],
  providers: [TrustService],
  exports: [TrustService],
})
export class TrustModule {}
