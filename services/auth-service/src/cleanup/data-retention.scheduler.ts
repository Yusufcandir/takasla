import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { RefreshTokenEntity } from '../tokens/refresh-token.entity';
import { VerificationTokenEntity } from '../tokens/verification-token.entity';

@Injectable()
export class DataRetentionScheduler {
  private readonly logger = new Logger(DataRetentionScheduler.name);

  constructor(
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepo: Repository<RefreshTokenEntity>,
    @InjectRepository(VerificationTokenEntity)
    private readonly verificationTokenRepo: Repository<VerificationTokenEntity>,
  ) {}

  /** Weekly: remove expired/revoked refresh tokens and used/expired verification tokens */
  @Cron(CronExpression.EVERY_WEEK)
  async cleanExpiredTokens(): Promise<void> {
    const now = new Date();

    // Delete refresh tokens that are expired or revoked
    const refreshResult = await this.refreshTokenRepo.delete([
      { expiresAt: LessThan(now) },
      { revoked: true },
    ]);
    if (refreshResult.affected) {
      this.logger.log(`Cleaned ${refreshResult.affected} expired/revoked refresh tokens`);
    }

    // Delete verification tokens that are used, or expired > 7 days ago
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const usedResult = await this.verificationTokenRepo.delete({ used: true });
    const expiredResult = await this.verificationTokenRepo.delete({
      expiresAt: LessThan(sevenDaysAgo),
    });
    const total = (usedResult.affected || 0) + (expiredResult.affected || 0);
    if (total) {
      this.logger.log(`Cleaned ${total} used/expired verification tokens`);
    }
  }
}
