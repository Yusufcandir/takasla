import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not } from 'typeorm';
import { DisputeEntity } from '../disputes/dispute.entity';
import { EvidenceEntity } from '../disputes/evidence.entity';
import { DisputeStatus } from '@exchange/shared-types';

@Injectable()
export class DataRetentionScheduler {
  private readonly logger = new Logger(DataRetentionScheduler.name);

  constructor(
    @InjectRepository(DisputeEntity)
    private readonly disputeRepo: Repository<DisputeEntity>,
    @InjectRepository(EvidenceEntity)
    private readonly evidenceRepo: Repository<EvidenceEntity>,
  ) {}

  /** Monthly: anonymize PII in disputes resolved more than 2 years ago */
  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async anonymizeOldDisputes(): Promise<void> {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    // Find resolved disputes older than 2 years that still have real user IDs
    const oldDisputes = await this.disputeRepo
      .createQueryBuilder('d')
      .select('d.id')
      .where('d.resolved_at < :cutoff', { cutoff: twoYearsAgo })
      .andWhere('d.resolved_at IS NOT NULL')
      .andWhere("d.opened_by != :anon", { anon: '[deleted user]' })
      .getMany();

    if (oldDisputes.length === 0) return;

    const disputeIds = oldDisputes.map((d) => d.id);

    // Anonymize dispute opener and description
    const disputeResult = await this.disputeRepo
      .createQueryBuilder()
      .update(DisputeEntity)
      .set({
        openedBy: '[deleted user]',
        description: '[removed — data retention policy]',
      })
      .whereInIds(disputeIds)
      .execute();

    // Anonymize evidence uploader in those disputes
    const evidenceResult = await this.evidenceRepo
      .createQueryBuilder()
      .update(EvidenceEntity)
      .set({ uploadedBy: '[deleted user]' })
      .where('dispute_id IN (:...ids)', { ids: disputeIds })
      .execute();

    this.logger.log(
      `Anonymized ${disputeResult.affected} disputes and ${evidenceResult.affected} evidence records older than 2 years`,
    );
  }
}
