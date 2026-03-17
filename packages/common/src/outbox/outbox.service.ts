import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { OutboxEntity } from './outbox.entity';
import { RabbitMQService } from '../rabbitmq/rabbitmq.service';

@Injectable()
export class OutboxService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxService.name);
  private pollingInterval: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(OutboxEntity)
    private readonly outboxRepo: Repository<OutboxEntity>,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  onApplicationBootstrap(): void {
    this.startPolling(2000);
  }

  onApplicationShutdown(): void {
    this.stopPolling();
  }

  async addToOutbox(
    manager: EntityManager,
    aggregateType: string,
    aggregateId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<OutboxEntity> {
    const entry = manager.create(OutboxEntity, {
      aggregateType,
      aggregateId,
      eventType,
      payload,
      published: false,
    });
    return manager.save(entry);
  }

  async publishPending(): Promise<number> {
    const entries = await this.outboxRepo.find({
      where: { published: false },
      order: { createdAt: 'ASC' },
      take: 100,
    });

    let published = 0;
    for (const entry of entries) {
      try {
        await this.rabbitMQService.publish(entry.eventType, entry.payload);
        entry.published = true;
        entry.publishedAt = new Date();
        await this.outboxRepo.save(entry);
        published++;
      } catch (error) {
        this.logger.error(`Failed to publish outbox entry ${entry.id}`, error);
        break;
      }
    }
    return published;
  }

  startPolling(intervalMs = 1000): void {
    this.pollingInterval = setInterval(async () => {
      try {
        await this.publishPending();
      } catch (error) {
        this.logger.error('Outbox polling error', error);
      }
    }, intervalMs);
    this.logger.log(`Outbox polling started (interval: ${intervalMs}ms)`);
  }

  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      this.logger.log('Outbox polling stopped');
    }
  }
}
