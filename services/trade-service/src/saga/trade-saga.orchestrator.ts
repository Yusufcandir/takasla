import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SagaInstanceEntity } from './saga-instance.entity';
import { SagaState } from '@exchange/shared-types';
import { OutboxService } from '@exchange/common';

export interface SagaStep {
  name: string;
  execute: (data: Record<string, unknown>) => Promise<Record<string, unknown>>;
  compensate: (data: Record<string, unknown>) => Promise<void>;
}

@Injectable()
export class TradeSagaOrchestrator {
  private readonly logger = new Logger(TradeSagaOrchestrator.name);

  constructor(
    @InjectRepository(SagaInstanceEntity)
    private readonly sagaRepo: Repository<SagaInstanceEntity>,
    private readonly dataSource: DataSource,
    private readonly outboxService: OutboxService,
  ) {}

  async executeSaga(
    tradeId: string,
    sagaType: string,
    steps: SagaStep[],
    initialData: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<SagaInstanceEntity> {
    const saga = await this.sagaRepo.save({
      tradeId,
      sagaType,
      currentStep: steps[0].name,
      state: SagaState.RUNNING as SagaState,
      stepData: initialData,
      compensations: [] as Array<{ step: string; data: Record<string, unknown> }>,
      idempotencyKey,
    });

    let data = { ...initialData };

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      try {
        this.logger.log(`Saga ${saga.id}: executing step '${step.name}'`);
        saga.currentStep = step.name;
        await this.sagaRepo.save(saga);

        const result = await step.execute(data);
        data = { ...data, ...result };

        saga.compensations = [
          { step: step.name, data: { ...data } },
          ...saga.compensations,
        ];
        saga.stepData = data;
        await this.sagaRepo.save(saga);
      } catch (error) {
        this.logger.error(`Saga ${saga.id}: step '${step.name}' failed`, error);
        saga.state = SagaState.COMPENSATING;
        await this.sagaRepo.save(saga);

        await this.compensate(saga, steps.slice(0, i).reverse());
        return saga;
      }
    }

    saga.state = SagaState.COMPLETED;
    saga.currentStep = 'done';
    await this.sagaRepo.save(saga);
    this.logger.log(`Saga ${saga.id}: completed successfully`);
    return saga;
  }

  private async compensate(
    saga: SagaInstanceEntity,
    stepsToCompensate: SagaStep[],
  ): Promise<void> {
    for (const step of stepsToCompensate) {
      const compData = saga.compensations.find((c) => c.step === step.name);
      try {
        this.logger.log(`Saga ${saga.id}: compensating step '${step.name}'`);
        await step.compensate(compData?.data || {});
      } catch (error) {
        this.logger.error(
          `Saga ${saga.id}: compensation for '${step.name}' failed`,
          error,
        );
        saga.state = SagaState.FAILED;
        await this.sagaRepo.save(saga);
        return;
      }
    }

    saga.state = SagaState.FAILED;
    saga.currentStep = 'compensated';
    await this.sagaRepo.save(saga);
    this.logger.log(`Saga ${saga.id}: compensation completed`);
  }
}
