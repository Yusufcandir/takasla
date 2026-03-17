import { Injectable, Logger } from '@nestjs/common';
import { TradeState, RiskLevel } from '@exchange/shared-types';
import { TradeEntity } from '../trades/trade.entity';
import { TRANSITIONS } from './transitions';

export interface TransitionResult {
  success: boolean;
  fromState?: TradeState;
  newState?: TradeState;
  reason?: string;
  sideEffects?: string[];
}

@Injectable()
export class TradeStateMachine {
  private readonly logger = new Logger(TradeStateMachine.name);

  transition(trade: TradeEntity, event: string, triggeredBy?: string): TransitionResult {
    const currentState = trade.state;
    const transitionDef = TRANSITIONS.find(
      (t) => t.from === currentState && t.event === event,
    );

    if (!transitionDef) {
      return {
        success: false,
        fromState: currentState,
        reason: `No transition for event '${event}' from state '${currentState}'`,
      };
    }

    if (transitionDef.guard && !transitionDef.guard(trade, triggeredBy)) {
      return {
        success: false,
        fromState: currentState,
        reason: transitionDef.guardFailReason || 'Guard condition not met',
      };
    }

    this.logger.log(
      `Trade ${trade.id}: ${currentState} -> ${transitionDef.to} (event: ${event})`,
    );

    return {
      success: true,
      fromState: currentState,
      newState: transitionDef.to,
      sideEffects: transitionDef.sideEffects,
    };
  }

  getAvailableTransitions(trade: TradeEntity): string[] {
    return TRANSITIONS
      .filter((t) => t.from === trade.state)
      .map((t) => t.event);
  }
}
