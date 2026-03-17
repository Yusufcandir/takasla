import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { DatabaseModule, RabbitMQModule, RedisModule, HealthModule, OutboxModule, StorageModule } from '@exchange/common';
import { TradesModule } from './trades/trades.module';
import { StateMachineModule } from './state-machine/state-machine.module';
import { SagaModule } from './saga/saga.module';
import { RiskModule } from './risk/risk.module';
import { EscrowModule } from './escrow/escrow.module';
import { TradeEntity } from './trades/trade.entity';
import { TradeEventEntity } from './trades/trade-event.entity';
import { TradeLockEntity } from './trades/trade-lock.entity';
import { ProofPackageEntity } from './trades/proof-package.entity';
import { SagaInstanceEntity } from './saga/saga-instance.entity';
import { OutboxEntity } from '@exchange/common';
import { VerificationCenterEntity } from './centers/verification-center.entity';
import { CenterVerificationEntity } from './centers/center-verification.entity';
import { CentersModule } from './centers/centers.module';
import { ProofImageHashEntity } from './proofs/proof-image-hash.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule.forRoot({
      entities: [TradeEntity, TradeEventEntity, TradeLockEntity, ProofPackageEntity, SagaInstanceEntity, OutboxEntity, VerificationCenterEntity, CenterVerificationEntity, ProofImageHashEntity],
      migrationsDir: join(__dirname, 'migrations'),
      dbHostEnv: 'TRADE_DB_HOST',
      dbPortEnv: 'TRADE_DB_PORT',
      dbNameEnv: 'TRADE_DB_NAME',
      dbUserEnv: 'TRADE_DB_USER',
      dbPasswordEnv: 'TRADE_DB_PASSWORD',
    }),
    RabbitMQModule.forRoot(),
    RedisModule.forRoot(),
    OutboxModule,
    StorageModule.forRoot(),
    HealthModule,
    TradesModule,
    StateMachineModule,
    SagaModule,
    RiskModule,
    EscrowModule,
    CentersModule,
  ],
})
export class AppModule {}
