import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RatingEntity } from '../ratings/rating.entity';
import { FraudFlagEntity } from '../fraud/fraud-flag.entity';
import { UserCleanupListener } from './user-cleanup.listener';

@Module({
  imports: [TypeOrmModule.forFeature([RatingEntity, FraudFlagEntity])],
  providers: [UserCleanupListener],
})
export class CleanupModule {}
