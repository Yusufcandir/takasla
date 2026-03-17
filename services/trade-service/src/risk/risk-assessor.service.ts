import { Injectable, Logger } from '@nestjs/common';
import { RiskLevel } from '@exchange/shared-types';

export interface RiskAssessmentInput {
  categoryRiskWeight: number; // 0-1
  trustScore: number; // 0-100
  disputeCount: number;
}

export interface RiskAssessmentResult {
  riskLevel: RiskLevel;
  riskScore: number;
  factors: {
    categoryWeight: number;
    reputationPenalty: number;
    disputeHistory: number;
  };
}

@Injectable()
export class RiskAssessorService {
  private readonly logger = new Logger(RiskAssessorService.name);

  assess(input: RiskAssessmentInput): RiskAssessmentResult {
    // Category risk weight is now the primary risk driver (60% weight)
    // since we removed user-declared value to prevent fee gaming
    const categoryWeight = Math.min(Math.max(input.categoryRiskWeight, 0), 1);
    const reputationPenalty = 1 - Math.min(input.trustScore, 100) / 100;
    const disputeHistory = Math.min(input.disputeCount / 5, 1.0);

    const riskScore =
      categoryWeight * 0.6 +
      reputationPenalty * 0.25 +
      disputeHistory * 0.15;

    let riskLevel: RiskLevel;
    if (riskScore < 0.3) riskLevel = RiskLevel.LOW;
    else if (riskScore < 0.6) riskLevel = RiskLevel.MEDIUM;
    else riskLevel = RiskLevel.HIGH;

    this.logger.log(
      `Risk assessment: score=${riskScore.toFixed(3)}, level=${riskLevel}`,
    );

    return {
      riskLevel,
      riskScore: parseFloat(riskScore.toFixed(4)),
      factors: { categoryWeight, reputationPenalty, disputeHistory },
    };
  }

  getDisputeWindowHours(riskLevel: RiskLevel): number {
    switch (riskLevel) {
      case RiskLevel.LOW: return 24;
      case RiskLevel.MEDIUM: return 72;
      case RiskLevel.HIGH: return 168; // 7 days
    }
  }

  getStepTimeoutHours(riskLevel: RiskLevel): number {
    switch (riskLevel) {
      case RiskLevel.LOW: return 24;
      case RiskLevel.MEDIUM: return 48;
      case RiskLevel.HIGH: return 72;
    }
  }
}
