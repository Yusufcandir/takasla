import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@exchange/common';
import { TradeLockEntity } from '../trades/trade-lock.entity';

@Injectable()
export class LockService {
  private readonly logger = new Logger(LockService.name);

  constructor(
    @InjectRepository(TradeLockEntity)
    private readonly lockRepo: Repository<TradeLockEntity>,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async acquireLock(
    manager: EntityManager,
    tradeId: string,
    listingId: string,
    userId: string,
    ttlSeconds = 3600,
  ): Promise<boolean> {
    const lockKey = `listing:lock:${listingId}`;

    const acquired = await this.redis.set(lockKey, tradeId, 'EX', ttlSeconds, 'NX');
    if (!acquired) {
      this.logger.warn(`Failed to acquire lock for listing ${listingId}`);
      return false;
    }

    await manager.save(TradeLockEntity, {
      tradeId,
      listingId,
      lockedBy: userId,
      lockType: 'escrow',
    });

    this.logger.log(`Lock acquired: listing=${listingId}, trade=${tradeId}`);
    return true;
  }

  async releaseLock(
    manager: EntityManager,
    tradeId: string,
    listingId: string,
  ): Promise<void> {
    const lockKey = `listing:lock:${listingId}`;
    const currentHolder = await this.redis.get(lockKey);

    if (currentHolder === tradeId) {
      await this.redis.del(lockKey);
    }

    await manager
      .createQueryBuilder()
      .update(TradeLockEntity)
      .set({ releasedAt: new Date() })
      .where('tradeId = :tradeId AND listingId = :listingId AND releasedAt IS NULL', {
        tradeId,
        listingId,
      })
      .execute();

    this.logger.log(`Lock released: listing=${listingId}, trade=${tradeId}`);
  }

  async isLocked(listingId: string): Promise<boolean> {
    const lockKey = `listing:lock:${listingId}`;
    const exists = await this.redis.exists(lockKey);
    return exists === 1;
  }
}
