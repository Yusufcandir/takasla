import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShipmentEntity } from './shipment.entity';
import { ShipmentEventEntity } from './shipment-event.entity';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';
import { ShipmentSimulationScheduler } from './shipment-simulation.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([ShipmentEntity, ShipmentEventEntity])],
  controllers: [ShipmentsController],
  providers: [ShipmentsService, ShipmentSimulationScheduler],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
