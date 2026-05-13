import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrustScoreEntity } from './trust-score.entity';
import { RabbitMQService } from '@exchange/common';
import { ROUTING_KEYS, QUEUES } from '@exchange/shared-types';

@Injectable()
export class TrustService {
  private readonly logger = new Logger(TrustService.name);

  constructor(
    @InjectRepository(TrustScoreEntity)
    private readonly trustRepo: Repository<TrustScoreEntity>,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async onModuleInit() {
    await this.rabbitMQService.subscribe(
      QUEUES.USER_ON_REPUTATION,
      [ROUTING_KEYS.REPUTATION.SCORE_UPDATED],
      async (msg: Record<string, unknown>) => {
        const userId = msg.userId as string;
        const newScore = msg.newScore as number;
        if (!userId || newScore == null) return;
        this.logger.log(`Received trust score update for user ${userId}: ${newScore}`);
        await this.updateTrustScore(userId, newScore);
      },
    );
  }

  async getUserTrustScore(userId: string): Promise<TrustScoreEntity> {
    let trust = await this.trustRepo.findOne({ where: { userId } });
    if (!trust) {
      trust = this.trustRepo.create({ userId, score: 0, riskFlags: [] });
      trust = await this.trustRepo.save(trust);
    }
    return trust;
  }

  async updateTrustScore(userId: string, score: number, components?: Record<string, number>): Promise<TrustScoreEntity> {
    let trust = await this.trustRepo.findOne({ where: { userId } });
    if (!trust) {
      trust = this.trustRepo.create({ userId, score, components, riskFlags: [], lastCalculated: new Date() });
    } else {
      trust.score = score;
      trust.components = components || trust.components;
      trust.lastCalculated = new Date();
    }
    return this.trustRepo.save(trust);
  }

  async addRiskFlag(userId: string, flag: string): Promise<TrustScoreEntity> {
    const trust = await this.getUserTrustScore(userId);
    if (!trust.riskFlags.includes(flag)) {
      trust.riskFlags = [...trust.riskFlags, flag];
    }
    return this.trustRepo.save(trust);
  }

  async removeRiskFlag(userId: string, flag: string): Promise<TrustScoreEntity> {
    const trust = await this.getUserTrustScore(userId);
    trust.riskFlags = trust.riskFlags.filter((f) => f !== flag);
    return this.trustRepo.save(trust);
  }
}
