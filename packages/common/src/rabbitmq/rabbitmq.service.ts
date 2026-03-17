import { Injectable, OnModuleInit, OnModuleDestroy, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import amqp from 'amqplib';
import { EXCHANGE_NAME, EXCHANGE_TYPE } from '@exchange/shared-types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  // Use 'any' to avoid amqplib version-specific type mismatches
  private connection: any = null;
  private channel: any = null;
  private readonly logger = new Logger(RabbitMQService.name);
  // Stored so publish/subscribe can await connection even if called before onModuleInit completes
  private connectionReady: Promise<void> | null = null;

  constructor(
    private readonly config: ConfigService,
    @Inject('RABBITMQ_OPTIONS') private readonly options: { queue?: string },
  ) {}

  async onModuleInit(): Promise<void> {
    this.connectionReady = this.connect();
    await this.connectionReady;
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  private async connect(): Promise<void> {
    const host = this.config.get<string>('RABBITMQ_HOST', 'localhost');
    const port = this.config.get<number>('RABBITMQ_PORT', 5672);
    const user = this.config.get<string>('RABBITMQ_USER', 'exchange');
    const password = this.config.get<string>('RABBITMQ_PASSWORD', 'exchange_dev_password');
    const url = `amqp://${user}:${password}@${host}:${port}`;

    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(EXCHANGE_NAME, EXCHANGE_TYPE, { durable: true });
      this.logger.log('Connected to RabbitMQ');
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ', error);
      throw error;
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connectionReady) {
      this.connectionReady = this.connect();
    }
    await this.connectionReady;
  }

  async publish(routingKey: string, message: Record<string, unknown>): Promise<void> {
    await this.ensureConnected();
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    const payload = Buffer.from(JSON.stringify({
      ...message,
      eventId: message['eventId'] || uuidv4(),
      timestamp: message['timestamp'] || new Date().toISOString(),
    }));

    this.channel.publish(EXCHANGE_NAME, routingKey, payload, {
      persistent: true,
      contentType: 'application/json',
    });

    this.logger.debug(`Published message to ${routingKey}`);
  }

  async subscribe(
    queueName: string,
    routingKeys: string[],
    handler: (msg: Record<string, unknown>, routingKey: string) => Promise<void>,
  ): Promise<void> {
    await this.ensureConnected();
    if (!this.channel) {
      throw new Error('RabbitMQ channel not initialized');
    }

    await this.channel.assertQueue(queueName, { durable: true });

    for (const key of routingKeys) {
      await this.channel.bindQueue(queueName, EXCHANGE_NAME, key);
    }

    await this.channel.consume(queueName, async (msg: any) => {
      if (!msg) return;

      try {
        const content = JSON.parse(msg.content.toString());
        await handler(content, msg.fields.routingKey);
        this.channel.ack(msg);
      } catch (error) {
        this.logger.error(`Error processing message from ${queueName}`, error);
        this.channel.nack(msg, false, true);
      }
    });

    this.logger.log(`Subscribed to queue: ${queueName} with keys: ${routingKeys.join(', ')}`);
  }

  private async close(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
      this.logger.log('RabbitMQ connection closed');
    } catch (error) {
      this.logger.error('Error closing RabbitMQ connection', error);
    }
  }
}
