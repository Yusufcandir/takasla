import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisputeEntity } from './dispute.entity';
import { EvidenceEntity } from './evidence.entity';
import { ModeratorActionEntity } from './moderator-action.entity';
import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { SlaSchedulerService } from './sla-scheduler.service';

@Module({
  imports: [TypeOrmModule.forFeature([DisputeEntity, EvidenceEntity, ModeratorActionEntity])],
  controllers: [DisputesController],
  providers: [DisputesService, SlaSchedulerService],
  exports: [DisputesService],
})
export class DisputesModule {}
