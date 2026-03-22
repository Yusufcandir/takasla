import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisputeEntity } from '../disputes/dispute.entity';
import { EvidenceEntity } from '../disputes/evidence.entity';
import { UserCleanupListener } from './user-cleanup.listener';
import { DataRetentionScheduler } from './data-retention.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([DisputeEntity, EvidenceEntity])],
  providers: [UserCleanupListener, DataRetentionScheduler],
})
export class CleanupModule {}
