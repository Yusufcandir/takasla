import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FraudFlagEntity } from './fraud-flag.entity';
import { CompletedTradeEntity } from '../ratings/completed-trade.entity';
import { RatingEntity } from '../ratings/rating.entity';
import { RabbitMQService } from '@exchange/common';
import { QUEUES, ROUTING_KEYS } from '@exchange/shared-types';

@Injectable()
export class FraudDetectionService implements OnModuleInit {
  private readonly logger = new Logger(FraudDetectionService.name);

  constructor(
    @InjectRepository(FraudFlagEntity)
    private readonly flagRepo: Repository<FraudFlagEntity>,
    @InjectRepository(CompletedTradeEntity)
    private readonly completedTradeRepo: Repository<CompletedTradeEntity>,
    @InjectRepository(RatingEntity)
    private readonly ratingRepo: Repository<RatingEntity>,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async onModuleInit() {
    // Run fraud checks after each trade completion
    await this.rabbitMQService.subscribe(
      'fraud.on-trade-events',
      [ROUTING_KEYS.TRADE.COMPLETED],
      async (msg: Record<string, unknown>) => {
        const { tradeId, partyAId, partyBId } = msg as {
          tradeId: string;
          partyAId: string;
          partyBId: string;
        };
        await this.checkCircularTrading(partyAId, partyBId, tradeId);
        await this.checkRapidRatingExchange(partyAId, partyBId, tradeId);
      },
    );

    // Create fraud flags when duplicate proof files are detected
    await this.rabbitMQService.subscribe(
      QUEUES.FRAUD_ON_TRADE,
      [ROUTING_KEYS.TRADE.DUPLICATE_PROOF_DETECTED],
      async (msg: Record<string, unknown>) => {
        const { tradeId, userId, duplicateWarnings } = msg as {
          tradeId: string;
          userId: string;
          duplicateWarnings: Array<{ fileName: string; duplicateOfTradeId: string; distance: number }>;
        };

        // Check if we already flagged this user for this trade
        const existing = await this.flagRepo.findOne({
          where: { userId, flagType: 'duplicate_proof', relatedTradeId: tradeId },
        });
        if (existing) return;

        const fileNames = duplicateWarnings.map(w => w.fileName).join(', ');
        const matchedTradeIds = [...new Set(duplicateWarnings.map(w => w.duplicateOfTradeId))];

        await this.flagRepo.save({
          userId,
          flagType: 'duplicate_proof',
          description: `User submitted ${duplicateWarnings.length} proof file(s) previously used in other trades: ${fileNames}`,
          evidence: {
            duplicateWarnings,
            matchedTradeIds,
          },
          relatedTradeId: tradeId,
        });

        this.logger.warn(
          `Fraud flag created: duplicate proof by user ${userId} in trade ${tradeId} ` +
          `(${duplicateWarnings.length} files match trades: ${matchedTradeIds.join(', ')})`,
        );
      },
    );

    // Create fraud flags when AI-generated images are detected in listings
    await this.rabbitMQService.subscribe(
      QUEUES.FRAUD_ON_LISTING,
      [ROUTING_KEYS.LISTING.AI_IMAGE_DETECTED],
      async (msg: Record<string, unknown>) => {
        const { listingId, userId, flaggedImages } = msg as {
          listingId: string;
          userId: string;
          flaggedImages: Array<{ url: string; aiScore: number }>;
        };

        const existing = await this.flagRepo.findOne({
          where: { userId, flagType: 'ai_generated_image', relatedTradeId: listingId },
        });
        if (existing) return;

        const maxScore = Math.max(...flaggedImages.map((f) => f.aiScore));

        await this.flagRepo.save({
          userId,
          flagType: 'ai_generated_image',
          description: `Listing contains ${flaggedImages.length} image(s) flagged as AI-generated (max score: ${maxScore.toFixed(2)})`,
          evidence: { listingId, flaggedImages, maxScore },
          relatedTradeId: listingId,
        });

        this.logger.warn(`Fraud flag created: AI-generated images by user ${userId} in listing ${listingId}`);
      },
    );
  }

  // Detect circular trading: A↔B repeated trades (>= 3 trades between same pair)
  async checkCircularTrading(userA: string, userB: string, tradeId: string): Promise<void> {
    const trades = await this.completedTradeRepo.find({
      where: [
        { partyAId: userA, partyBId: userB },
        { partyAId: userB, partyBId: userA },
      ],
    });

    if (trades.length >= 3) {
      const existing = await this.flagRepo.findOne({
        where: { userId: userA, flagType: 'circular_trading', relatedUserId: userB },
      });
      if (existing) return;

      await this.flagRepo.save({
        userId: userA,
        flagType: 'circular_trading',
        description: `${trades.length} trades between same user pair (possible trust score inflation)`,
        evidence: { tradeCount: trades.length, tradeIds: trades.map(t => t.tradeId) },
        relatedUserId: userB,
        relatedTradeId: tradeId,
      });

      // Flag both users
      await this.flagRepo.save({
        userId: userB,
        flagType: 'circular_trading',
        description: `${trades.length} trades between same user pair (possible trust score inflation)`,
        evidence: { tradeCount: trades.length, tradeIds: trades.map(t => t.tradeId) },
        relatedUserId: userA,
        relatedTradeId: tradeId,
      });

      this.logger.warn(`Circular trading detected: ${userA} <-> ${userB} (${trades.length} trades)`);
    }
  }

  // Detect rapid rating exchange: A rates B highly and B rates A highly within same day
  async checkRapidRatingExchange(userA: string, userB: string, tradeId: string): Promise<void> {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const ratingsAB = await this.ratingRepo
      .createQueryBuilder('r')
      .where('r.rater_id = :userA AND r.rated_user_id = :userB', { userA, userB })
      .andWhere('r.created_at > :since', { since: oneDayAgo })
      .andWhere('r.score >= 4')
      .getCount();

    const ratingsBA = await this.ratingRepo
      .createQueryBuilder('r')
      .where('r.rater_id = :userB AND r.rated_user_id = :userA', { userB, userA })
      .andWhere('r.created_at > :since', { since: oneDayAgo })
      .andWhere('r.score >= 4')
      .getCount();

    if (ratingsAB >= 1 && ratingsBA >= 1) {
      const existing = await this.flagRepo.findOne({
        where: { userId: userA, flagType: 'rapid_rating', relatedTradeId: tradeId },
      });
      if (existing) return;

      await this.flagRepo.save({
        userId: userA,
        flagType: 'rapid_rating',
        description: 'Mutual high ratings exchanged within 24h (possible collusion)',
        evidence: { ratingsAB, ratingsBA },
        relatedUserId: userB,
        relatedTradeId: tradeId,
      });

      this.logger.warn(`Rapid rating exchange detected: ${userA} <-> ${userB}`);
    }
  }

  async getFlagsByUser(userId: string): Promise<FraudFlagEntity[]> {
    return this.flagRepo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async getUnreviewedFlags(): Promise<FraudFlagEntity[]> {
    return this.flagRepo.find({ where: { reviewed: false }, order: { createdAt: 'ASC' } });
  }

  async reviewFlag(flagId: string, reviewerId: string): Promise<FraudFlagEntity> {
    const flag = await this.flagRepo.findOneBy({ id: flagId });
    if (!flag) throw new Error('Flag not found');
    flag.reviewed = true;
    flag.reviewedBy = reviewerId;
    flag.reviewedAt = new Date();
    return this.flagRepo.save(flag);
  }
}
