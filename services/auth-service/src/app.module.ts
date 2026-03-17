import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { DatabaseModule, RabbitMQModule, HealthModule } from '@exchange/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { UserEntity } from './users/user.entity';
import { RefreshTokenEntity } from './tokens/refresh-token.entity';
import { VerificationTokenEntity } from './tokens/verification-token.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.forRoot({
      entities: [UserEntity, RefreshTokenEntity, VerificationTokenEntity],
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
  ],
})
export class AppModule {}
