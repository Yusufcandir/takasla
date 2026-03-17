import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { TrustScoreSnapshotEntity } from './trust-score-snapshot.entity';
import { RatingEntity } from '../ratings/rating.entity';
import { ROUTING_KEYS } from '@exchange/shared-types';
import { RabbitMQService } from '@exchange/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class TrustScoreService {
  private readonly logger = new Logger(TrustScoreService.name);

  constructor(
    @InjectRepository(TrustScoreSnapshotEntity)
    private readonly snapshotRepo: Repository<TrustScoreSnapshotEntity>,
    @InjectRepository(RatingEntity)
    private readonly ratingRepo: Repository<RatingEntity>,
    private readonly rabbitMQService: RabbitMQService,
    private readonly config: ConfigService,
  ) {}

  async recalculate(userId: string): Promise<number> {
    const ratings = await this.ratingRepo.find({ where: { ratedUserId: userId } });

    if (ratings.length === 0) return 50;

    const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    // Temporal decay + rater trust weight: recent ratings and high-trust raters count more
    let weightedSum = 0;
    let totalWeight = 0;
    for (const r of ratings) {
      const ageWeight = r.createdAt > sixMonthsAgo ? 1.0 : 0.5;
      const raterTrust = await this.getRaterTrustWeight(r.raterId);
      const weight = ageWeight * raterTrust;
      weightedSum += r.score * weight;
      totalWeight += weight;
    }

    const avgRating = totalWeight > 0 ? weightedSum / totalWeight : 2.5;
    const ratingScore = (avgRating / 5) * 35;
    const volumeBonus = Math.min(ratings.length / 20, 1) * 15;
    const consistencyScore = this.calculateConsistency(ratings) * 15;
    const whitewashPenalty = this.detectWhitewashing(ratings) * 20;

    // Dispute factor: fetch dispute count and penalize
    const disputePenalty = await this.calculateDisputePenalty(userId);

    const totalScore = Math.min(100, Math.max(0,
      20 + ratingScore + volumeBonus + consistencyScore - whitewashPenalty - disputePenalty,
    ));

    const components = {
      ratingScore: parseFloat(ratingScore.toFixed(2)),
      volumeBonus: parseFloat(volumeBonus.toFixed(2)),
      consistencyScore: parseFloat(consistencyScore.toFixed(2)),
      whitewashPenalty: parseFloat(whitewashPenalty.toFixed(2)),
      disputePenalty: parseFloat(disputePenalty.toFixed(2)),
    };

    const previousSnapshot = await this.snapshotRepo.findOne({
      where: { userId },
      order: { snapshotAt: 'DESC' },
    });

    const score = parseFloat(totalScore.toFixed(2));

    await this.snapshotRepo.save({ userId, score, components });

    await this.rabbitMQService.publish(ROUTING_KEYS.REPUTATION.SCORE_UPDATED, {
      eventId: uuidv4(),
      correlationId: uuidv4(),
      idempotencyKey: `trust:${userId}:${Date.now()}`,
      userId,
      previousScore: previousSnapshot?.score || 50,
      newScore: score,
    });

    this.logger.log(`Trust score recalculated for user ${userId}: ${score}`);
    return score;
  }

  private calculateConsistency(ratings: RatingEntity[]): number {
    if (ratings.length < 3) return 0.5;
    const scores = ratings.map((r) => r.score);
    const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
    const variance = scores.reduce((s, v) => s + (v - mean) ** 2, 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    return Math.max(0, 1 - stdDev / 2);
  }

  /**
   * Whitewashing detection: look for patterns where a user creates new
   * accounts to reset reputation. Detected by sudden score improvements
   * after periods of low scores.
   */
  private detectWhitewashing(ratings: RatingEntity[]): number {
    if (ratings.length < 5) return 0;

    const sorted = [...ratings].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );

    const recentWindow = sorted.slice(-5);
    const olderWindow = sorted.slice(0, Math.max(1, sorted.length - 5));

    const recentAvg = recentWindow.reduce((s, r) => s + r.score, 0) / recentWindow.length;
    const olderAvg = olderWindow.reduce((s, r) => s + r.score, 0) / olderWindow.length;

    if (olderAvg < 2.5 && recentAvg > 4.0) {
      return 0.5;
    }

    return 0;
  }

  // Get rater's trust weight (high-trust raters count more)
  private async getRaterTrustWeight(raterId: string): Promise<number> {
    const snapshot = await this.snapshotRepo.findOne({
      where: { userId: raterId },
      order: { snapshotAt: 'DESC' },
    });
    if (!snapshot) return 0.5; // no history = neutral weight
    // Scale: score 0-100 → weight 0.3-1.0
    return 0.3 + (snapshot.score / 100) * 0.7;
  }

  // Dispute penalty: each dispute costs -3 points, max -15
  private async calculateDisputePenalty(userId: string): Promise<number> {
    try {
      const disputeUrl = this.config.get<string>('DISPUTE_SERVICE_URL', 'http://dispute-service:3007');
      const res = await fetch(`${disputeUrl}/disputes/user/${userId}/count`);
      if (!res.ok) return 0;
      const data = await res.json() as { count: number };
      return Math.min(data.count * 3, 15);
    } catch {
      return 0;
    }
  }

  async getScore(userId: string): Promise<{ score: number; components: Record<string, number> } | null> {
    const snapshot = await this.snapshotRepo.findOne({
      where: { userId },
      order: { snapshotAt: 'DESC' },
    });
    if (!snapshot) return null;
    return { score: snapshot.score, components: snapshot.components };
  }

  async getHistory(userId: string): Promise<TrustScoreSnapshotEntity[]> {
    return this.snapshotRepo.find({
      where: { userId },
      order: { snapshotAt: 'ASC' },
    });
  }
}
