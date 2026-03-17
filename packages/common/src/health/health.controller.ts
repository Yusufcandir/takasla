import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator, HealthCheckResult } from '@nestjs/terminus';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis,
  ) {}

  @Get()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    const checks = [
      () => this.db.pingCheck('database'),
    ];

    if (this.redis) {
      checks.push(() =>
        this.redis!.ping().then(() => ({
          redis: { status: 'up' as const },
        })).catch(() => {
          throw { redis: { status: 'down' as const } };
        }),
      );
    }

    return this.health.check(checks);
  }
}
