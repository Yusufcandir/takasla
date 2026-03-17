import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { DatabaseModule, RabbitMQModule, OutboxModule, HealthModule } from '@exchange/common';
import { OutboxEntity } from '@exchange/common';
import { PaymentsModule } from './payments/payments.module';
import { PaymentEntity } from './payments/payment.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.forRoot({
      entities: [PaymentEntity, OutboxEntity],
      migrationsDir: join(__dirname, 'migrations'),
      dbHostEnv: 'PAYMENT_DB_HOST',
      dbPortEnv: 'PAYMENT_DB_PORT',
      dbNameEnv: 'PAYMENT_DB_NAME',
      dbUserEnv: 'PAYMENT_DB_USER',
      dbPasswordEnv: 'PAYMENT_DB_PASSWORD',
    }),
    RabbitMQModule.forRoot(),
    OutboxModule,
    HealthModule,
    PaymentsModule,
  ],
})
export class AppModule {}
