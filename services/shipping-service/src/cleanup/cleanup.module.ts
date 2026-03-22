import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShipmentEntity } from '../shipments/shipment.entity';
import { UserCleanupListener } from './user-cleanup.listener';

@Module({
  imports: [TypeOrmModule.forFeature([ShipmentEntity])],
  providers: [UserCleanupListener],
})
export class CleanupModule {}
