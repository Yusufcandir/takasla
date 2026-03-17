import { RiskLevel } from '@exchange/shared-types';
import { RiskAssessorService } from '../risk-assessor.service';

// Formula reference (category-based, no declaredValue):
//   riskScore = categoryWeight*0.6 + reputationPenalty*0.25 + disputeHistory*0.15
//   categoryWeight   = clamp(categoryRiskWeight, 0, 1)
//   reputationPenalty = 1 - min(trustScore, 100) / 100
//   disputeHistory   = min(disputeCount / 5, 1.0)
//   LOW < 0.3 · MEDIUM < 0.6 · HIGH >= 0.6

describe('RiskAssessorService', () => {
  let assessor: RiskAssessorService;

  beforeEach(() => {
    assessor = new RiskAssessorService();
  });

  // ─── Formula correctness ──────────────────────────────────────────────────────

  describe('Formula correctness', () => {
    it('all-zero inputs → riskScore 0.00, level LOW', () => {
      const result = assessor.assess({
        categoryRiskWeight: 0,
        trustScore: 100,
        disputeCount: 0,
      });
      expect(result.riskScore).toBe(0);
      expect(result.riskLevel).toBe(RiskLevel.LOW);
      expect(result.factors.categoryWeight).toBe(0);
      expect(result.factors.reputationPenalty).toBe(0);
      expect(result.factors.disputeHistory).toBe(0);
    });

    it('all-max inputs → riskScore 1.00, level HIGH', () => {
      const result = assessor.assess({
        categoryRiskWeight: 1.0,
        trustScore: 0,
        disputeCount: 5,
      });
      expect(result.riskScore).toBe(1.0);
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
    });

    it('luxury watch, trust=80, 0 disputes → HIGH (score = 0.65)', () => {
      // 1.0*0.6 + 0.2*0.25 + 0*0.15 = 0.6 + 0.05 + 0 = 0.65
      const result = assessor.assess({
        categoryRiskWeight: 1.0,
        trustScore: 80,
        disputeCount: 0,
      });
      expect(result.riskScore).toBeCloseTo(0.65, 4);
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
    });

    it('electronics (0.5), trust=80, 0 disputes → MEDIUM (score = 0.35)', () => {
      // 0.5*0.6 + 0.2*0.25 + 0*0.15 = 0.3 + 0.05 + 0 = 0.35
      const result = assessor.assess({
        categoryRiskWeight: 0.5,
        trustScore: 80,
        disputeCount: 0,
      });
      expect(result.riskScore).toBeCloseTo(0.35, 4);
      expect(result.riskLevel).toBe(RiskLevel.MEDIUM);
    });

    it('clothing (0.3), trust=80, 0 disputes → LOW (score = 0.23)', () => {
      // 0.3*0.6 + 0.2*0.25 + 0*0.15 = 0.18 + 0.05 + 0 = 0.23
      const result = assessor.assess({
        categoryRiskWeight: 0.3,
        trustScore: 80,
        disputeCount: 0,
      });
      expect(result.riskScore).toBeCloseTo(0.23, 4);
      expect(result.riskLevel).toBe(RiskLevel.LOW);
    });

    it('mid-range category, neutral trust → MEDIUM', () => {
      // 0.5*0.6 + 0.5*0.25 + 0.2*0.15 = 0.30 + 0.125 + 0.03 = 0.455
      const result = assessor.assess({
        categoryRiskWeight: 0.5,
        trustScore: 50,
        disputeCount: 1,
      });
      expect(result.riskLevel).toBe(RiskLevel.MEDIUM);
      expect(result.riskScore).toBeGreaterThanOrEqual(0.3);
      expect(result.riskScore).toBeLessThan(0.6);
    });
  });

  // ─── Level boundary values ────────────────────────────────────────────────────

  describe('Level boundary thresholds', () => {
    it('score exactly at LOW/MEDIUM boundary (0.3) → MEDIUM', () => {
      // cat=0.5, trust=100, disp=0 → 0.5*0.6 + 0 + 0 = 0.30 → MEDIUM
      const result = assessor.assess({
        categoryRiskWeight: 0.5,
        trustScore: 100,
        disputeCount: 0,
      });
      expect(result.riskScore).toBe(0.3);
      expect(result.riskLevel).toBe(RiskLevel.MEDIUM);
    });

    it('score just below LOW/MEDIUM boundary → LOW', () => {
      const result = assessor.assess({
        categoryRiskWeight: 0,
        trustScore: 100,
        disputeCount: 0,
      });
      expect(result.riskScore).toBeLessThan(0.3);
      expect(result.riskLevel).toBe(RiskLevel.LOW);
    });

    it('score exactly at MEDIUM/HIGH boundary (0.6) → HIGH', () => {
      // cat=1.0, trust=100, disp=0 → 1.0*0.6 + 0 + 0 = 0.60 → HIGH
      const result = assessor.assess({
        categoryRiskWeight: 1.0,
        trustScore: 100,
        disputeCount: 0,
      });
      expect(result.riskScore).toBe(0.6);
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
    });

    it('score just below MEDIUM/HIGH boundary → MEDIUM', () => {
      // cat=0.9, trust=100, disp=0 → 0.9*0.6 = 0.54 → MEDIUM
      const result = assessor.assess({
        categoryRiskWeight: 0.9,
        trustScore: 100,
        disputeCount: 0,
      });
      expect(result.riskScore).toBeLessThan(0.6);
      expect(result.riskLevel).toBe(RiskLevel.MEDIUM);
    });
  });

  // ─── Input capping / clamping ─────────────────────────────────────────────────

  describe('Input capping and clamping', () => {
    it('trustScore capped at 100 — trust=150 same as trust=100', () => {
      const r1 = assessor.assess({ categoryRiskWeight: 0.5, trustScore: 150, disputeCount: 2 });
      const r2 = assessor.assess({ categoryRiskWeight: 0.5, trustScore: 100, disputeCount: 2 });
      expect(r1.riskScore).toBe(r2.riskScore);
    });

    it('trustScore=0 → reputationPenalty = 1.0 (full penalty)', () => {
      const result = assessor.assess({ categoryRiskWeight: 0, trustScore: 0, disputeCount: 0 });
      expect(result.factors.reputationPenalty).toBe(1.0);
      expect(result.riskScore).toBeCloseTo(0.25, 4);
    });

    it('disputeCount capped at 5 — disp=10 same as disp=5', () => {
      const r1 = assessor.assess({ categoryRiskWeight: 0.5, trustScore: 80, disputeCount: 10 });
      const r2 = assessor.assess({ categoryRiskWeight: 0.5, trustScore: 80, disputeCount: 5 });
      expect(r1.riskScore).toBe(r2.riskScore);
      expect(r1.factors.disputeHistory).toBe(1.0);
      expect(r2.factors.disputeHistory).toBe(1.0);
    });

    it('categoryRiskWeight clamped to [0,1] — negative weight treated as 0', () => {
      const r1 = assessor.assess({ categoryRiskWeight: -0.5, trustScore: 100, disputeCount: 0 });
      const r2 = assessor.assess({ categoryRiskWeight: 0, trustScore: 100, disputeCount: 0 });
      expect(r1.riskScore).toBe(r2.riskScore);
    });

    it('categoryRiskWeight > 1 clamped to 1', () => {
      const r1 = assessor.assess({ categoryRiskWeight: 2.0, trustScore: 100, disputeCount: 0 });
      const r2 = assessor.assess({ categoryRiskWeight: 1.0, trustScore: 100, disputeCount: 0 });
      expect(r1.riskScore).toBe(r2.riskScore);
    });
  });

  // ─── Factors breakdown ────────────────────────────────────────────────────────

  describe('Factors breakdown', () => {
    it('returns correct individual factors', () => {
      const result = assessor.assess({
        categoryRiskWeight: 0.8,
        trustScore: 70,
        disputeCount: 2,
      });
      expect(result.factors.categoryWeight).toBe(0.8);
      expect(result.factors.reputationPenalty).toBeCloseTo(0.3, 10);    // 1 - 70/100
      expect(result.factors.disputeHistory).toBe(0.4);                   // 2/5
    });
  });

  // ─── Dispute window and timeout helpers ───────────────────────────────────────

  describe('getDisputeWindowHours', () => {
    it('LOW → 24 hours', () => expect(assessor.getDisputeWindowHours(RiskLevel.LOW)).toBe(24));
    it('MEDIUM → 72 hours', () => expect(assessor.getDisputeWindowHours(RiskLevel.MEDIUM)).toBe(72));
    it('HIGH → 168 hours (7 days)', () => expect(assessor.getDisputeWindowHours(RiskLevel.HIGH)).toBe(168));
  });

  describe('getStepTimeoutHours', () => {
    it('LOW → 24 hours', () => expect(assessor.getStepTimeoutHours(RiskLevel.LOW)).toBe(24));
    it('MEDIUM → 48 hours', () => expect(assessor.getStepTimeoutHours(RiskLevel.MEDIUM)).toBe(48));
    it('HIGH → 72 hours', () => expect(assessor.getStepTimeoutHours(RiskLevel.HIGH)).toBe(72));
  });
});
