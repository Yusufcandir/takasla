import { Module } from '@nestjs/common';
import { TradeStateMachine } from './trade-state-machine';

@Module({
  providers: [TradeStateMachine],
  exports: [TradeStateMachine],
})
export class StateMachineModule {}
