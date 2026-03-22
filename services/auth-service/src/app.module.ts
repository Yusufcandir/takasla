import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { DatabaseModule, RabbitMQModule, HealthModule } from '@exchange/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { CleanupModule } from './cleanup/cleanup.module';
import { UserEntity } from './users/user.entity';
import { BannedEmailEntity } from './users/banned-email.entity';
import { RefreshTokenEntity } from './tokens/refresh-token.entity';
import { VerificationTokenEntity } from './tokens/verification-token.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule.forRoot({
      entities: [UserEntity, BannedEmailEntity, RefreshTokenEntity, VerificationTokenEntity],
      migrationsDir: join(__dirname, 'migrations'),
      dbHostEnv: 'AUTH_DB_HOST',
      dbPortEnv: 'AUTH_DB_PORT',
      dbNameEnv: 'AUTH_DB_NAME',
      dbUserEnv: 'AUTH_DB_USER',
      dbPasswordEnv: 'AUTH_DB_PASSWORD',
    }),
    RabbitMQModule.forRoot(),
    HealthModule,
    AuthModule,
    UsersModule,
    CleanupModule,
  ],
})
export class AppModule {}
