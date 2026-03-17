import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxModule } from '@exchange/common';
import { SagaInstanceEntity } from './saga-instance.entity';
import { TradeSagaOrchestrator } from './trade-saga.orchestrator';

@Module({
  imports: [TypeOrmModule.forFeature([SagaInstanceEntity]), OutboxModule],
  providers: [TradeSagaOrchestrator],
  exports: [TradeSagaOrchestrator],
})
export class SagaModule {}
