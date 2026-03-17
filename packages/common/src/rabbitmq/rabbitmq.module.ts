import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RabbitMQService } from './rabbitmq.service';

export interface RabbitMQModuleOptions {
  queue?: string;
}

@Module({})
export class RabbitMQModule {
  static forRoot(options?: RabbitMQModuleOptions): DynamicModule {
    return {
      module: RabbitMQModule,
      imports: [ConfigModule],
      providers: [
        {
          provide: 'RABBITMQ_OPTIONS',
          useValue: options || {},
        },
        RabbitMQService,
      ],
      exports: [RabbitMQService],
      global: true,
    };
  }
}
