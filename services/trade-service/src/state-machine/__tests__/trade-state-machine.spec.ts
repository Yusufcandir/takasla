import { v4 as uuidv4 } from 'uuid';
import { TradeState, RiskLevel } from '@exchange/shared-types';
import { TradeStateMachine } from '../trade-state-machine';
import { TradeEntity } from '../../trades/trade.entity';

function makeTrade(overrides: Partial<TradeEntity> = {}): TradeEntity {
  const trade = new TradeEntity();
  trade.id = uuidv4();
  trade.offerId = uuidv4();
  trade.partyAId = 'user-a';
  trade.partyBId = 'user-b';
  trade.listingAId = 'listing-a';
  trade.listingBId = 'listing-b';
  trade.state = TradeState.ACCEPTED;
  trade.riskLevel = RiskLevel.MEDIUM;
  trade.proofASubmitted = false;
  trade.proofBSubmitted = false;
  trade.riskFactors = {};
  trade.version = 1;
  trade.createdAt = new Date();
  trade.updatedAt = new Date();
  Object.assign(trade, overrides);
  return trade;
}

describe('TradeStateMachine', () => {
  let machine: TradeStateMachine;

  beforeEach(() => {
    machine = new TradeStateMachine();
  });

  // ─── Happy path transitions ──────────────────────────────────────────────────

  describe('Happy path transitions', () => {
    it('ACCEPTED → LOCKED via items_locked', () => {
      const trade = makeTrade({ state: TradeState.ACCEPTED });
      const result = machine.transition(trade, 'items_locked');
      expect(result.success).toBe(true);
      expect(result.fromState).toBe(TradeState.ACCEPTED);
      expect(result.newState).toBe(TradeState.LOCKED);
      expect(result.sideEffects).toContain('publish_trade_locked');
    });

    it('LOCKED → PROOF_SUBMITTED via proof_submitted (MEDIUM, both proofs submitted)', () => {
      const trade = makeTrade({
        state: TradeState.LOCKED,
        riskLevel: RiskLevel.MEDIUM,
        proofASubmitted: true,
        proofBSubmitted: true,
      });
      const result = machine.transition(trade, 'proof_submitted');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.PROOF_SUBMITTED);
    });

    it('LOCKED → PROOF_SUBMITTED via proof_submitted (HIGH, both proofs submitted)', () => {
      const trade = makeTrade({
        state: TradeState.LOCKED,
        riskLevel: RiskLevel.HIGH,
        proofASubmitted: true,
        proofBSubmitted: true,
      });
      const result = machine.transition(trade, 'proof_submitted');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.PROOF_SUBMITTED);
    });

    it('LOCKED → PROOF_SUBMITTED via proof_submitted (LOW risk, single party)', () => {
      const trade = makeTrade({
        state: TradeState.LOCKED,
        riskLevel: RiskLevel.LOW,
        proofASubmitted: true,
        proofBSubmitted: false,
      });
      const result = machine.transition(trade, 'proof_submitted');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.PROOF_SUBMITTED);
    });

    it('PROOF_SUBMITTED → UNDER_VERIFICATION via begin_verification (MEDIUM)', () => {
      const trade = makeTrade({
        state: TradeState.PROOF_SUBMITTED,
        riskLevel: RiskLevel.MEDIUM,
      });
      const result = machine.transition(trade, 'begin_verification');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.UNDER_VERIFICATION);
    });

    it('PROOF_SUBMITTED → UNDER_VERIFICATION via begin_verification (HIGH)', () => {
      const trade = makeTrade({
        state: TradeState.PROOF_SUBMITTED,
        riskLevel: RiskLevel.HIGH,
      });
      const result = machine.transition(trade, 'begin_verification');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.UNDER_VERIFICATION);
    });

    it('PROOF_SUBMITTED → VERIFIED via auto_verify (LOW risk)', () => {
      const trade = makeTrade({
        state: TradeState.PROOF_SUBMITTED,
        riskLevel: RiskLevel.LOW,
      });
      const result = machine.transition(trade, 'auto_verify');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.VERIFIED);
    });

    it('UNDER_VERIFICATION → VERIFIED via verified', () => {
      const trade = makeTrade({ state: TradeState.UNDER_VERIFICATION });
      const result = machine.transition(trade, 'verified');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.VERIFIED);
      expect(result.sideEffects).toContain('generate_certificate');
    });

    it('UNDER_VERIFICATION → LOCKED via verification_rejected', () => {
      const trade = makeTrade({ state: TradeState.UNDER_VERIFICATION });
      const result = machine.transition(trade, 'verification_rejected');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.LOCKED);
    });

    it('VERIFIED → COMPLETED via dispute_window_expired', () => {
      const trade = makeTrade({
        state: TradeState.VERIFIED,
        disputeWindowEnd: new Date(Date.now() - 1000),
      });
      const result = machine.transition(trade, 'dispute_window_expired');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.COMPLETED);
    });

    it('VERIFIED → DISPUTE_OPEN via dispute_opened (window still open)', () => {
      const trade = makeTrade({
        state: TradeState.VERIFIED,
        disputeWindowEnd: new Date(Date.now() + 3_600_000),
      });
      const result = machine.transition(trade, 'dispute_opened');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.DISPUTE_OPEN);
    });

    it('DISPUTE_OPEN → COMPLETED via dispute_resolved', () => {
      const trade = makeTrade({ state: TradeState.DISPUTE_OPEN });
      const result = machine.transition(trade, 'dispute_resolved');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.COMPLETED);
    });

    it('DISPUTE_OPEN → REVOKED via trade_revoked', () => {
      const trade = makeTrade({ state: TradeState.DISPUTE_OPEN });
      const result = machine.transition(trade, 'trade_revoked');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.REVOKED);
    });

    it('INITIATED → OFFERED via offer_made', () => {
      const trade = makeTrade({ state: TradeState.INITIATED });
      const result = machine.transition(trade, 'offer_made');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.OFFERED);
    });

    it('OFFERED → ACCEPTED via offer_accepted', () => {
      const trade = makeTrade({ state: TradeState.OFFERED });
      const result = machine.transition(trade, 'offer_accepted');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.ACCEPTED);
    });

    it('OFFERED → CANCELLED via offer_rejected', () => {
      const trade = makeTrade({ state: TradeState.OFFERED });
      const result = machine.transition(trade, 'offer_rejected');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.CANCELLED);
    });
  });

  // ─── Cancel transitions ──────────────────────────────────────────────────────

  describe('Cancel transitions', () => {
    it('ACCEPTED → CANCELLED via cancel (no lockedAt)', () => {
      const trade = makeTrade({ state: TradeState.ACCEPTED, lockedAt: undefined });
      const result = machine.transition(trade, 'cancel');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.CANCELLED);
    });

    it('LOCKED → CANCELLED via cancel', () => {
      const trade = makeTrade({ state: TradeState.LOCKED });
      const result = machine.transition(trade, 'cancel');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.CANCELLED);
    });

    it('PROOF_SUBMITTED → CANCELLED via cancel', () => {
      const trade = makeTrade({ state: TradeState.PROOF_SUBMITTED });
      const result = machine.transition(trade, 'cancel');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.CANCELLED);
    });

    it('UNDER_VERIFICATION → CANCELLED via cancel', () => {
      const trade = makeTrade({ state: TradeState.UNDER_VERIFICATION });
      const result = machine.transition(trade, 'cancel');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.CANCELLED);
    });

    it('OFFERED → CANCELLED via timeout', () => {
      const trade = makeTrade({ state: TradeState.OFFERED });
      const result = machine.transition(trade, 'timeout');
      expect(result.success).toBe(true);
      expect(result.newState).toBe(TradeState.CANCELLED);
    });
  });

  // ─── Guard failures ──────────────────────────────────────────────────────────

  describe('Guard failures', () => {
    it('auto_verify fails for MEDIUM risk', () => {
      const trade = makeTrade({
        state: TradeState.PROOF_SUBMITTED,
        riskLevel: RiskLevel.MEDIUM,
      });
      const result = machine.transition(trade, 'auto_verify');
      expect(result.success).toBe(false);
      expect(result.reason).toMatch(/low risk/i);
    });

    it('auto_verify fails for HIGH risk', () => {
      const trade = makeTrade({
        state: TradeState.PROOF_SUBMITTED,
        riskLevel: RiskLevel.HIGH,
      });
      const result = machine.transition(trade, 'auto_verify');
      expect(result.success).toBe(false);
    });

    it('begin_verification fails for LOW risk', () => {
      const trade = makeTrade({
        state: TradeState.PROOF_SUBMITTED,
        riskLevel: RiskLevel.LOW,
      });
      const result = machine.transition(trade, 'begin_verification');
      expect(result.success).toBe(false);
      expect(result.reason).toMatch(/medium.high/i);
    });

    it('proof_submitted fails if only partyA submitted and risk is MEDIUM', () => {
      const trade = makeTrade({
        state: TradeState.LOCKED,
        riskLevel: RiskLevel.MEDIUM,
        proofASubmitted: true,
        proofBSubmitted: false,
      });
      const result = machine.transition(trade, 'proof_submitted');
      expect(result.success).toBe(false);
      expect(result.reason).toMatch(/both parties/i);
    });

    it('proof_submitted fails if only partyB submitted and risk is HIGH', () => {
      const trade = makeTrade({
        state: TradeState.LOCKED,
        riskLevel: RiskLevel.HIGH,
        proofASubmitted: false,
        proofBSubmitted: true,
      });
      const result = machine.transition(trade, 'proof_submitted');
      expect(result.success).toBe(false);
    });

    it('proof_submitted fails if neither party submitted and risk is MEDIUM', () => {
      const trade = makeTrade({
        state: TradeState.LOCKED,
        riskLevel: RiskLevel.MEDIUM,
        proofASubmitted: false,
        proofBSubmitted: false,
      });
      const result = machine.transition(trade, 'proof_submitted');
      expect(result.success).toBe(false);
    });

    it('dispute_opened fails when disputeWindowEnd is in the past', () => {
      const trade = makeTrade({
        state: TradeState.VERIFIED,
        disputeWindowEnd: new Date(Date.now() - 1000),
      });
      const result = machine.transition(trade, 'dispute_opened');
      expect(result.success).toBe(false);
      expect(result.reason).toMatch(/expired/i);
    });

    it('dispute_opened fails when disputeWindowEnd is not set', () => {
      const trade = makeTrade({
        state: TradeState.VERIFIED,
        disputeWindowEnd: undefined,
      });
      const result = machine.transition(trade, 'dispute_opened');
      expect(result.success).toBe(false);
    });

    it('wrong-state event fails: applying verified to LOCKED state', () => {
      const trade = makeTrade({ state: TradeState.LOCKED });
      const result = machine.transition(trade, 'verified');
      expect(result.success).toBe(false);
      expect(result.reason).toMatch(/No transition/i);
    });

    it('wrong-state event fails: applying items_locked to PROOF_SUBMITTED', () => {
      const trade = makeTrade({ state: TradeState.PROOF_SUBMITTED });
      const result = machine.transition(trade, 'items_locked');
      expect(result.success).toBe(false);
    });

    it('nonexistent event always fails', () => {
      const trade = makeTrade({ state: TradeState.ACCEPTED });
      const result = machine.transition(trade, 'nonexistent_event_xyz');
      expect(result.success).toBe(false);
      expect(result.reason).toMatch(/No transition/i);
    });

    it('COMPLETED is terminal — no transitions succeed', () => {
      const trade = makeTrade({ state: TradeState.COMPLETED });
      expect(machine.transition(trade, 'cancel').success).toBe(false);
      expect(machine.transition(trade, 'dispute_opened').success).toBe(false);
    });

    it('CANCELLED is terminal — no transitions succeed', () => {
      const trade = makeTrade({ state: TradeState.CANCELLED });
      expect(machine.transition(trade, 'items_locked').success).toBe(false);
      expect(machine.transition(trade, 'cancel').success).toBe(false);
    });
  });

  // ─── getAvailableTransitions ─────────────────────────────────────────────────

  describe('getAvailableTransitions', () => {
    it('ACCEPTED → items_locked and cancel', () => {
      const trade = makeTrade({ state: TradeState.ACCEPTED });
      const events = machine.getAvailableTransitions(trade);
      expect(events).toHaveLength(2);
      expect(events).toEqual(expect.arrayContaining(['items_locked', 'cancel']));
    });

    it('OFFERED → offer_accepted, offer_rejected, timeout', () => {
      const trade = makeTrade({ state: TradeState.OFFERED });
      const events = machine.getAvailableTransitions(trade);
      expect(events).toHaveLength(3);
      expect(events).toEqual(expect.arrayContaining(['offer_accepted', 'offer_rejected', 'timeout']));
    });

    it('VERIFIED → dispute_opened and dispute_window_expired', () => {
      const trade = makeTrade({ state: TradeState.VERIFIED });
      const events = machine.getAvailableTransitions(trade);
      expect(events).toHaveLength(2);
      expect(events).toEqual(expect.arrayContaining(['dispute_opened', 'dispute_window_expired']));
    });

    it('LOCKED → proof_submitted and cancel', () => {
      const trade = makeTrade({ state: TradeState.LOCKED });
      const events = machine.getAvailableTransitions(trade);
      expect(events).toHaveLength(2);
      expect(events).toEqual(expect.arrayContaining(['proof_submitted', 'cancel']));
    });

    it('DISPUTE_OPEN → dispute_resolved and trade_revoked', () => {
      const trade = makeTrade({ state: TradeState.DISPUTE_OPEN });
      const events = machine.getAvailableTransitions(trade);
      expect(events).toHaveLength(2);
      expect(events).toEqual(expect.arrayContaining(['dispute_resolved', 'trade_revoked']));
    });

    it('COMPLETED is terminal — returns empty array', () => {
      const trade = makeTrade({ state: TradeState.COMPLETED });
      expect(machine.getAvailableTransitions(trade)).toHaveLength(0);
    });

    it('CANCELLED is terminal — returns empty array', () => {
      const trade = makeTrade({ state: TradeState.CANCELLED });
      expect(machine.getAvailableTransitions(trade)).toHaveLength(0);
    });

    it('REVOKED is terminal — returns empty array', () => {
      const trade = makeTrade({ state: TradeState.REVOKED });
      expect(machine.getAvailableTransitions(trade)).toHaveLength(0);
    });
  });
});
