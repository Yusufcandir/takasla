import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ShipmentsService } from './shipments.service';

@Injectable()
export class ShipmentSimulationScheduler {
  private readonly logger = new Logger(ShipmentSimulationScheduler.name);

  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Cron('*/30 * * * * *')
  async autoDeliverSimulatedShipments() {
    const shipments = await this.shipmentsService.findPendingSimulatedShipments();
    if (shipments.length === 0) return;

    this.logger.log(`Auto-delivering ${shipments.length} simulated shipment(s)`);

    for (const shipment of shipments) {
      try {
        await this.shipmentsService.instantDeliverSimulated(shipment);
        this.logger.log(`Auto-delivered shipment ${shipment.id} (${shipment.trackingNumber})`);
      } catch (error) {
        this.logger.warn(`Failed to auto-deliver shipment ${shipment.id}: ${error}`);
      }
    }
  }
}
