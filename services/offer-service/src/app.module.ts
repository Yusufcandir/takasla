import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { DatabaseModule, RabbitMQModule, RedisModule, HealthModule } from '@exchange/common';
import { OffersModule } from './offers/offers.module';
import { OfferEntity } from './offers/offer.entity';
import { CounterOfferEntity } from './offers/counter-offer.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.forRoot({
      entities: [OfferEntity, CounterOfferEntity],
      migrationsDir: join(__dirname, 'migrations'),
      dbHostEnv: 'OFFER_DB_HOST',
      dbPortEnv: 'OFFER_DB_PORT',
      dbNameEnv: 'OFFER_DB_NAME',
      dbUserEnv: 'OFFER_DB_USER',
      dbPasswordEnv: 'OFFER_DB_PASSWORD',
    }),
    RabbitMQModule.forRoot(),
    RedisModule.forRoot(),
    HealthModule,
    OffersModule,
  ],
})
export class AppModule {}
