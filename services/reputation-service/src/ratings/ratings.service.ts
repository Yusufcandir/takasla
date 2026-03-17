import { Injectable, Logger, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RatingEntity } from './rating.entity';
import { CompletedTradeEntity } from './completed-trade.entity';
import { ROUTING_KEYS, QUEUES } from '@exchange/shared-types';
import { RabbitMQService } from '@exchange/common';
import { TrustScoreService } from '../trust/trust-score.service';

@Injectable()
export class RatingsService {
  private readonly logger = new Logger(RatingsService.name);

  constructor(
    @InjectRepository(RatingEntity)
    private readonly ratingRepo: Repository<RatingEntity>,
    @InjectRepository(CompletedTradeEntity)
    private readonly completedTradeRepo: Repository<CompletedTradeEntity>,
    private readonly rabbitMQService: RabbitMQService,
    private readonly trustScoreService: TrustScoreService,
  ) {}

  async onModuleInit() {
    await this.rabbitMQService.subscribe(
      QUEUES.REPUTATION_ON_TRADE,
      [ROUTING_KEYS.TRADE.COMPLETED],
      async (msg) => {
        const { tradeId, partyAId, partyBId, riskLevel } = msg as {
          tradeId: string;
          partyAId: string;
          partyBId: string;
          riskLevel?: string;
        };
        const existing = await this.completedTradeRepo.findOne({ where: { tradeId } });
        if (existing) return;
        await this.completedTradeRepo.save({ tradeId, partyAId, partyBId, riskLevel });
        this.logger.log(`Trade ${tradeId} marked as completed — ratings now open`);
      },
    );
  }

  async submitRating(
    tradeId: string,
    raterId: string,
    ratedUserId: string,
    score: number,
    comment?: string,
  ): Promise<RatingEntity> {
    if (score < 1 || score > 5) throw new BadRequestException('Score must be between 1 and 5');
    if (raterId === ratedUserId) throw new BadRequestException('Cannot rate yourself');

    const completedTrade = await this.completedTradeRepo.findOne({ where: { tradeId } });
    if (!completedTrade) throw new ForbiddenException('Trade is not completed or not eligible for rating');

    const isParty = completedTrade.partyAId === raterId || completedTrade.partyBId === raterId;
    if (!isParty) throw new ForbiddenException('Only trade parties can submit ratings');

    const existing = await this.ratingRepo.findOne({ where: { tradeId, raterId } });
    if (existing) throw new BadRequestException('Already rated for this trade');

    const rating = await this.ratingRepo.save({ tradeId, raterId, ratedUserId, score, comment });
    await this.trustScoreService.recalculate(ratedUserId);

    this.logger.log(`Rating submitted: ${rating.id} (${score}/5) for user ${ratedUserId}`);
    return rating;
  }

  async findByUser(userId: string): Promise<{ ratings: RatingEntity[]; average: number }> {
    const ratings = await this.ratingRepo.find({
      where: { ratedUserId: userId },
      order: { createdAt: 'DESC' },
    });

    const average = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
      : 0;

    return { ratings, average: parseFloat(average.toFixed(2)) };
  }

  async findByTrade(tradeId: string): Promise<RatingEntity[]> {
    return this.ratingRepo.find({ where: { tradeId } });
  }
}
