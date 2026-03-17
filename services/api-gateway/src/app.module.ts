import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ProxyModule } from './proxy/proxy.module';
import { AuthValidationMiddleware } from './middleware/auth-validation.middleware';
import { AuthRateLimitMiddleware } from './middleware/auth-rate-limit.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 1000,
    }]),
    ProxyModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthRateLimitMiddleware)
      .forRoutes('api/auth/login', 'api/auth/register', 'api/auth/refresh');
    consumer
      .apply(AuthValidationMiddleware)
      .exclude('api/auth/(.*)', 'health', 'api/health')
      .forRoutes('*');
  }
}
