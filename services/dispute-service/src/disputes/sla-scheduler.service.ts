import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { DisputeEntity } from './dispute.entity';
import { ModeratorActionEntity } from './moderator-action.entity';
import { DisputeStatus } from '@exchange/shared-types';

@Injectable()
export class SlaSchedulerService {
  private readonly logger = new Logger(SlaSchedulerService.name);

  constructor(
    @InjectRepository(DisputeEntity)
    private readonly disputeRepo: Repository<DisputeEntity>,
    @InjectRepository(ModeratorActionEntity)
    private readonly actionRepo: Repository<ModeratorActionEntity>,
  ) {}

  // Run every 15 minutes — check for disputes that have breached SLA
  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkSlaBreaches() {
    const now = new Date();

    const overdueDisputes = await this.disputeRepo.find({
      where: {
        status: In([DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW]),
        slaDeadline: LessThan(now),
      },
    });

    if (overdueDisputes.length === 0) return;

    this.logger.warn(`Found ${overdueDisputes.length} disputes past SLA deadline`);

    for (const dispute of overdueDisputes) {
      // Auto-escalate to ESCALATED status
      dispute.status = DisputeStatus.ESCALATED;
      dispute.escalatedAt = new Date();
      await this.disputeRepo.save(dispute);

      await this.actionRepo.save({
        disputeId: dispute.id,
        moderatorId: 'system',
        actionType: 'auto_escalate',
        notes: `SLA breached (deadline was ${dispute.slaDeadline?.toISOString()}). Auto-escalated to admin.`,
      });

      this.logger.warn(`Dispute ${dispute.id} auto-escalated — SLA breached`);
    }
  }

  // Run every hour — check for resolved disputes past appeal deadline (finalize them)
  @Cron(CronExpression.EVERY_HOUR)
  async finalizeExpiredAppeals() {
    const now = new Date();

    const expiredDisputes = await this.disputeRepo.find({
      where: {
        status: DisputeStatus.RESOLVED,
        appealDeadline: LessThan(now),
      },
    });

    for (const dispute of expiredDisputes) {
      // No appeal was filed within the window — finalize as CLOSED
      dispute.status = DisputeStatus.CLOSED;
      await this.disputeRepo.save(dispute);

      await this.actionRepo.save({
        disputeId: dispute.id,
        moderatorId: 'system',
        actionType: 'auto_close',
        notes: 'Appeal deadline expired with no appeal. Dispute finalized.',
      });

      this.logger.log(`Dispute ${dispute.id} auto-closed — appeal window expired`);
    }
  }
}
