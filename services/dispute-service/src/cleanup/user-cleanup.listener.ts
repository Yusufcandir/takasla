import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RabbitMQService } from '@exchange/common';
import { QUEUES, ROUTING_KEYS } from '@exchange/shared-types';
import { DisputeEntity } from '../disputes/dispute.entity';
import { EvidenceEntity } from '../disputes/evidence.entity';

@Injectable()
export class UserCleanupListener implements OnModuleInit {
  private readonly logger = new Logger('DisputeUserCleanup');

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    @InjectRepository(DisputeEntity)
    private readonly disputeRepo: Repository<DisputeEntity>,
    @InjectRepository(EvidenceEntity)
    private readonly evidenceRepo: Repository<EvidenceEntity>,
  ) {}

  async onModuleInit() {
    await this.rabbitMQService.subscribe(
      QUEUES.DISPUTE_CLEANUP,
      [ROUTING_KEYS.AUTH.USER_DELETED],
      async (msg) => {
        try {
          const { userId } = msg as { userId: string };
          this.logger.log(`Anonymizing dispute-service data for user ${userId}`);

          const DELETED = '[deleted user]';

          // Anonymize dispute opener (keep records for legal compliance)
          await this.disputeRepo
            .createQueryBuilder()
            .update()
            .set({ openedBy: DELETED })
            .where('opened_by = :userId', { userId })
            .execute();

          // Anonymize evidence uploader
          await this.evidenceRepo
            .createQueryBuilder()
            .update()
            .set({ uploadedBy: DELETED })
            .where('uploaded_by = :userId', { userId })
            .execute();

          this.logger.log(`Dispute-service anonymization complete for user ${userId}`);
        } catch (err) {
          this.logger.error('Failed to anonymize dispute-service data', err);
        }
      },
    );

    this.logger.log('User cleanup listener subscribed');
  }
}
