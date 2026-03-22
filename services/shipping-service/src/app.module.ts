import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { DatabaseModule, RabbitMQModule, HealthModule } from '@exchange/common';
import { ShipmentsModule } from './shipments/shipments.module';
import { CarriersModule } from './carriers/carriers.module';
import { CleanupModule } from './cleanup/cleanup.module';
import { ShipmentEntity } from './shipments/shipment.entity';
import { ShipmentEventEntity } from './shipments/shipment-event.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule.forRoot({
      entities: [ShipmentEntity, ShipmentEventEntity],
      migrationsDir: join(__dirname, 'migrations'),
      dbHostEnv: 'SHIPPING_DB_HOST',
      dbPortEnv: 'SHIPPING_DB_PORT',
      dbNameEnv: 'SHIPPING_DB_NAME',
      dbUserEnv: 'SHIPPING_DB_USER',
      dbPasswordEnv: 'SHIPPING_DB_PASSWORD',
    }),
    RabbitMQModule.forRoot(),
    HealthModule,
    CarriersModule,
    ShipmentsModule,
    CleanupModule,
  ],
})
export class AppModule {}
