import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { DatabaseModule, RabbitMQModule, HealthModule } from '@exchange/common';
import { RatingsModule } from './ratings/ratings.module';
import { TrustModule } from './trust/trust.module';
import { FraudModule } from './fraud/fraud.module';
import { CleanupModule } from './cleanup/cleanup.module';
import { RatingEntity } from './ratings/rating.entity';
import { CompletedTradeEntity } from './ratings/completed-trade.entity';
import { TrustScoreSnapshotEntity } from './trust/trust-score-snapshot.entity';
import { FraudFlagEntity } from './fraud/fraud-flag.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.forRoot({
      entities: [RatingEntity, CompletedTradeEntity, TrustScoreSnapshotEntity, FraudFlagEntity],
      migrationsDir: join(__dirname, 'migrations'),
      dbHostEnv: 'REPUTATION_DB_HOST',
      dbPortEnv: 'REPUTATION_DB_PORT',
      dbNameEnv: 'REPUTATION_DB_NAME',
      dbUserEnv: 'REPUTATION_DB_USER',
      dbPasswordEnv: 'REPUTATION_DB_PASSWORD',
    }),
    RabbitMQModule.forRoot(),
    HealthModule,
    RatingsModule,
    TrustModule,
    FraudModule,
    CleanupModule,
  ],
})
export class AppModule {}
