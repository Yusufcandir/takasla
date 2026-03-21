import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { RabbitMQService } from '@exchange/common';
import { QUEUES, ROUTING_KEYS } from '@exchange/shared-types';
import { UsersService } from '../users/users.service';
import { EmailService } from './email.service';

@Injectable()
export class ModerationEmailListener implements OnModuleInit {
  private readonly logger = new Logger(ModerationEmailListener.name);

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
  ) {}

  async onModuleInit() {
    await this.rabbitMQService.subscribe(
      QUEUES.AUTH_ON_MODERATION,
      [
        ROUTING_KEYS.MODERATION.FRAUD_FLAG_REVIEWED,
        ROUTING_KEYS.MODERATION.LISTING_REPORT_REVIEWED,
        ROUTING_KEYS.MODERATION.LISTING_ARCHIVED,
        ROUTING_KEYS.MODERATION.DISPUTE_RESOLVED,
      ],
      async (msg, routingKey) => {
        try {
          await this.handleEvent(msg, routingKey);
        } catch (err) {
          this.logger.error(`Failed to send moderation email for ${routingKey}`, err);
          // Don't rethrow — email failures should not nack the message
        }
      },
    );

    this.logger.log('Moderation email listener subscribed');
  }

  private async handleEvent(msg: Record<string, unknown>, routingKey: string): Promise<void> {
    switch (routingKey) {
      case ROUTING_KEYS.MODERATION.FRAUD_FLAG_REVIEWED: {
        const { userId, flagType, description, reviewNotes, evidence } = msg as {
          userId: string; flagType: string; description: string;
          reviewNotes?: string; evidence?: Record<string, unknown>;
        };
        const email = await this.resolveEmail(userId);
        if (!email) return;

        const listingId = evidence?.listingId as string | undefined;
        await this.emailService.sendFraudFlagReviewedEmail(email, {
          flagType,
          description,
          reviewNotes,
          listingId,
          listingTitle: listingId ? 'Flagged Listing' : undefined,
        });
        break;
      }

      case ROUTING_KEYS.MODERATION.LISTING_REPORT_REVIEWED: {
        const { listingOwnerId, listingTitle, listingId, reportReason, status, adminNotes } = msg as {
          listingOwnerId: string; listingTitle: string; listingId: string;
          reportReason: string; status: string; adminNotes?: string;
        };
        const email = await this.resolveEmail(listingOwnerId);
        if (!email) return;
        await this.emailService.sendListingReportReviewedEmail(email, {
          listingTitle, listingId, reportReason, status, adminNotes,
        });
        break;
      }

      case ROUTING_KEYS.MODERATION.LISTING_ARCHIVED: {
        const { listingOwnerId, listingTitle, listingId } = msg as {
          listingOwnerId: string; listingTitle: string; listingId: string;
        };
        const email = await this.resolveEmail(listingOwnerId);
        if (!email) return;
        await this.emailService.sendListingArchivedEmail(email, { listingTitle, listingId });
        break;
      }

      case ROUTING_KEYS.MODERATION.DISPUTE_RESOLVED: {
        const { openedBy, disputeId, resolution, outcomeType, compensationAction, compensationAmount } = msg as {
          openedBy: string; disputeId: string; resolution: string;
          outcomeType: string; compensationAction: string; compensationAmount?: number;
        };
        const email = await this.resolveEmail(openedBy);
        if (!email) return;
        await this.emailService.sendDisputeResolvedEmail(email, {
          disputeId, resolution, outcomeType, compensationAction, compensationAmount,
        });
        break;
      }
    }
  }

  private async resolveEmail(userId: string): Promise<string | null> {
    try {
      const user = await this.usersService.findById(userId);
      return user.email;
    } catch {
      this.logger.warn(`Could not find user ${userId} for moderation email — user may be deleted`);
      return null;
    }
  }
}
