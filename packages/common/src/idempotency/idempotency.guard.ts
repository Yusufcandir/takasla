import { Injectable, CanActivate, ExecutionContext, ConflictException, Inject } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class IdempotencyGuard implements CanActivate {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['x-idempotency-key'];

    if (!idempotencyKey) return true;

    const lockKey = `idempotency:${idempotencyKey}`;
    const acquired = await this.redis.set(lockKey, '1', 'EX', 3600, 'NX');

    if (!acquired) {
      throw new ConflictException('Duplicate request detected');
    }

    return true;
  }
}
