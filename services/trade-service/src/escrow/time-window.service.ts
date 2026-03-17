import { Injectable, Logger } from '@nestjs/common';
import { RiskLevel } from '@exchange/shared-types';
import { RiskAssessorService } from '../risk/risk-assessor.service';

@Injectable()
export class TimeWindowService {
  private readonly logger = new Logger(TimeWindowService.name);

  constructor(private readonly riskAssessor: RiskAssessorService) {}

  calculateDisputeWindowEnd(riskLevel: RiskLevel): Date {
    const hours = this.riskAssessor.getDisputeWindowHours(riskLevel);
    const end = new Date();
    end.setHours(end.getHours() + hours);
    return end;
  }

  calculateStepTimeout(riskLevel: RiskLevel): Date {
    const hours = this.riskAssessor.getStepTimeoutHours(riskLevel);
    const timeout = new Date();
    timeout.setHours(timeout.getHours() + hours);
    return timeout;
  }

  isWithinWindow(deadline: Date): boolean {
    return new Date() < deadline;
  }
}
