import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule, RabbitMQModule, HealthModule, StorageModule } from '@exchange/common';
import { DisputesModule } from './disputes/disputes.module';
import { CleanupModule } from './cleanup/cleanup.module';
import { DisputeEntity } from './disputes/dispute.entity';
import { EvidenceEntity } from './disputes/evidence.entity';
import { ModeratorActionEntity } from './disputes/moderator-action.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.forRoot({
      entities: [DisputeEntity, EvidenceEntity, ModeratorActionEntity],
      migrationsDir: join(__dirname, 'migrations'),
      dbHostEnv: 'DISPUTE_DB_HOST',
      dbPortEnv: 'DISPUTE_DB_PORT',
      dbNameEnv: 'DISPUTE_DB_NAME',
      dbUserEnv: 'DISPUTE_DB_USER',
      dbPasswordEnv: 'DISPUTE_DB_PASSWORD',
    }),
    ScheduleModule.forRoot(),
    RabbitMQModule.forRoot(),
    StorageModule.forRoot(),
    HealthModule,
    DisputesModule,
    CleanupModule,
  ],
})
export class AppModule {}
