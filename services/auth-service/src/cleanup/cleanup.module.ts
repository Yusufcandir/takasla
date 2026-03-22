import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshTokenEntity } from '../tokens/refresh-token.entity';
import { VerificationTokenEntity } from '../tokens/verification-token.entity';
import { DataRetentionScheduler } from './data-retention.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([RefreshTokenEntity, VerificationTokenEntity])],
  providers: [DataRetentionScheduler],
})
export class CleanupModule {}
