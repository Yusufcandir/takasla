import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RabbitMQService } from '@exchange/common';
import { QUEUES, ROUTING_KEYS } from '@exchange/shared-types';
import { ShipmentEntity } from '../shipments/shipment.entity';

@Injectable()
export class UserCleanupListener implements OnModuleInit {
  private readonly logger = new Logger('ShippingUserCleanup');

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    @InjectRepository(ShipmentEntity)
    private readonly shipmentRepo: Repository<ShipmentEntity>,
  ) {}

  async onModuleInit() {
    await this.rabbitMQService.subscribe(
      QUEUES.SHIPPING_CLEANUP,
      [ROUTING_KEYS.AUTH.USER_DELETED],
      async (msg) => {
        try {
          const { userId } = msg as { userId: string };
          this.logger.log(`Anonymizing shipping-service data for user ${userId}`);

          const DELETED = '[deleted user]';

          // Anonymize sender/recipient address info in completed shipments
          await this.shipmentRepo
            .createQueryBuilder()
            .update()
            .set({
              senderName: DELETED,
              senderPhone: '',
              senderEmail: '',
              senderStreet: '',
            })
            .where('sender_id = :userId', { userId })
            .execute();

          await this.shipmentRepo
            .createQueryBuilder()
            .update()
            .set({
              recipientName: DELETED,
              recipientPhone: '',
              recipientEmail: '',
              recipientStreet: '',
            })
            .where('recipient_id = :userId', { userId })
            .execute();

          this.logger.log(`Shipping-service anonymization complete for user ${userId}`);
        } catch (err) {
          this.logger.error('Failed to anonymize shipping-service data', err);
        }
      },
    );

    this.logger.log('User cleanup listener subscribed');
  }
}
