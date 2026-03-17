import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TrustScoreEntity } from './trust-score.entity';

@Injectable()
export class TrustService {
  constructor(
    @InjectRepository(TrustScoreEntity)
    private readonly trustRepo: Repository<TrustScoreEntity>,
  ) {}

  async getUserTrustScore(userId: string): Promise<TrustScoreEntity> {
    let trust = await this.trustRepo.findOne({ where: { userId } });
    if (!trust) {
      trust = this.trustRepo.create({ userId, score: 50.0, riskFlags: [] });
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
