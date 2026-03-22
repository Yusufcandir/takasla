import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RabbitMQService } from '@exchange/common';
import { QUEUES, ROUTING_KEYS } from '@exchange/shared-types';
import { ProfileEntity } from '../profiles/profile.entity';
import { AddressEntity } from '../addresses/address.entity';

@Injectable()
export class UserCleanupListener implements OnModuleInit {
  private readonly logger = new Logger(UserCleanupListener.name);

  constructor(
    private readonly rabbitMQService: RabbitMQService,
    @InjectRepository(ProfileEntity)
    private readonly profileRepo: Repository<ProfileEntity>,
    @InjectRepository(AddressEntity)
    private readonly addressRepo: Repository<AddressEntity>,
  ) {}

  async onModuleInit() {
    await this.rabbitMQService.subscribe(
      QUEUES.USER_CLEANUP,
      [ROUTING_KEYS.AUTH.USER_DELETED],
      async (msg) => {
        try {
          const { userId } = msg as { userId: string };
          this.logger.log(`Cleaning up user-service data for user ${userId}`);

          await this.addressRepo.delete({ userId });
          await this.profileRepo.delete({ userId });

          this.logger.log(`User-service cleanup complete for user ${userId}`);
        } catch (err) {
          this.logger.error('Failed to clean up user-service data', err);
        }
      },
    );

    this.logger.log('User cleanup listener subscribed');
  }
}
