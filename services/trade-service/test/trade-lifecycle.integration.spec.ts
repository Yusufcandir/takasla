/**
 * Integration tests for the full trade lifecycle.
 *
 * Prerequisites (docker-compose.dev.yml must be running):
 *   - PostgreSQL on localhost:5437  (postgres-trade)
 *   - Redis    on localhost:6379
 *
 * RabbitMQ and external HTTP calls are mocked — only DB + Redis are real.
 *
 * Run with:
 *   pnpm --filter @exchange/trade-service test:integration
 */
import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { ConflictException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';

import {
  RabbitMQService, RedisModule, REDIS_CLIENT, OutboxEntity,
} from '@exchange/common';
import { TradeState, RiskLevel } from '@exchange/shared-types';

import { TradesModule } from '../src/trades/trades.module';
import { TradesService } from '../src/trades/trades.service';
import { TradeTimeoutScheduler } from '../src/trades/trade-timeout.scheduler';
import { ExternalDataService } from '../src/risk/external-data.service';
import { TradeEntity } from '../src/trades/trade.entity';
import { TradeEventEntity } from '../src/trades/trade-event.entity';
import { TradeLockEntity } from '../src/trades/trade-lock.entity';
import { ProofPackageEntity } from '../src/trades/proof-package.entity';

// ─── Mock RabbitMQ (global so OutboxModule can inject it) ────────────────────
//
// RabbitMQModule.forRoot() is global in production.  We recreate that
// behaviour with a @Global() module so OutboxService (inside OutboxModule)
// can resolve RabbitMQService without importing RabbitMQModule.

const mockRabbitMQ = {
  publish: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockResolvedValue(undefined),
  ensureConnected: jest.fn().mockResolvedValue(undefined),
};

@Global()
@Module({
  providers: [{ provide: RabbitMQService, useValue: mockRabbitMQ }],
  exports: [RabbitMQService],
})
class MockRabbitMQModule {}

// ─── Mock ExternalDataService (returns LOW-risk inputs by default) ───────────
//   cat=0.1, val=500, trust=80 → riskScore ≈ 0.12 → LOW

const mockExternalData = {
  getListingDetails: jest.fn().mockResolvedValue({ categoryId: 'cat-electronics', declaredValue: 500 }),
  getUserTrustScore: jest.fn().mockResolvedValue(80),
  getCategoryRiskWeight: jest.fn().mockResolvedValue(0.1),
};

// ─── Stable user IDs reused across tests ─────────────────────────────────────

const PARTY_A = uuidv4();
const PARTY_B = uuidv4();
const PARTY_C = uuidv4();
const PARTY_D = uuidv4();
const MODERATOR = uuidv4();

const proofItems = (tag: string) => [
  { type: 'photo', url: `https://example.com/${tag}.jpg`, hash: `hash_${tag}_1` },
  { type: 'document', url: `https://example.com/${tag}.pdf`, hash: `hash_${tag}_2` },
];

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Trade lifecycle — integration', () => {
  let moduleRef: TestingModule;
  let tradesService: TradesService;
  let scheduler: TradeTimeoutScheduler;
  let dataSource: DataSource;
  let redisClient: Redis;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.TRADE_DB_HOST ?? 'localhost',
          port: Number(process.env.TRADE_DB_PORT ?? 5437),
          username: process.env.TRADE_DB_USER ?? 'exchange',
          password: process.env.TRADE_DB_PASSWORD ?? 'exchange_dev_password',
          database: process.env.TRADE_DB_NAME ?? 'trade_db',
          entities: [TradeEntity, TradeEventEntity, TradeLockEntity, ProofPackageEntity, OutboxEntity],
          synchronize: true,
        }),
        MockRabbitMQModule,   // provides RabbitMQService globally (replaces RabbitMQModule.forRoot())
        RedisModule.forRoot(), // provides REDIS_CLIENT globally (same as in AppModule)
        ScheduleModule.forRoot(),
        TradesModule,
      ],
    })
      .overrideProvider(ExternalDataService)
      .useValue(mockExternalData)
      .compile();

    tradesService = moduleRef.get(TradesService);
    scheduler = moduleRef.get(TradeTimeoutScheduler);
    dataSource = moduleRef.get(DataSource);
    redisClient = moduleRef.get<Redis>(REDIS_CLIENT, { strict: false });
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    // Restore default mock implementations after clearAllMocks
    mockRabbitMQ.publish.mockResolvedValue(undefined);
    mockRabbitMQ.subscribe.mockResolvedValue(undefined);

    // Clear tables in FK-safe order
    await dataSource.query(
      'TRUNCATE TABLE outbox, proof_packages, trade_locks, trade_events, trades CASCADE',
    );

    // Release any Redis locks left from previous tests
    const lockKeys = await redisClient.keys('listing:lock:*');
    if (lockKeys.length > 0) {
      await redisClient.del(...lockKeys);
    }
  });

  // ─── LOW risk happy path (auto-verify) ───────────────────────────────────────

  describe('LOW risk — auto-verify path', () => {
    it('ACCEPTED → LOCKED → VERIFIED → COMPLETED without manual verification', async () => {
      const trade = await tradesService.createFromOffer(
        uuidv4(), PARTY_A, PARTY_B, uuidv4(), uuidv4(),
        RiskLevel.LOW, 0.15, {},
      );
      expect(trade.state).toBe(TradeState.ACCEPTED);

      const locked = await tradesService.lockItems(trade.id, PARTY_A);
      expect(locked.state).toBe(TradeState.LOCKED);
      expect(locked.lockedAt).toBeDefined();

      // LOW risk: single-party proof auto-verifies
      const afterProof = await tradesService.submitProof(trade.id, PARTY_A, proofItems('low-a'));
      expect(afterProof.state).toBe(TradeState.VERIFIED);
      expect(afterProof.disputeWindowEnd).toBeDefined();

      const completed = await tradesService.completeTrade(trade.id);
      expect(completed.state).toBe(TradeState.COMPLETED);
      expect(completed.completedAt).toBeDefined();
    });

    it('event log contains expected event types for LOW risk flow', async () => {
      const trade = await tradesService.createFromOffer(
        uuidv4(), PARTY_A, PARTY_B, uuidv4(), uuidv4(),
        RiskLevel.LOW, 0.15, {},
      );
      await tradesService.lockItems(trade.id, PARTY_A);
      await tradesService.submitProof(trade.id, PARTY_A, proofItems('ev-low'));
      await tradesService.completeTrade(trade.id);

      const events = await tradesService.getTradeEvents(trade.id);
      const types = events.map((e) => e.eventType);

      expect(types).toContain('trade.initiated');
      expect(types).toContain('trade.locked');
      expect(types).toContain('trade.proof_submitted');
      expect(types).toContain('trade.completed');
    });
  });

  // ─── MEDIUM risk happy path ───────────────────────────────────────────────────

  describe('MEDIUM risk — full verification path', () => {
    it('ACCEPTED → LOCKED → PROOF_SUBMITTED → UNDER_VERIFICATION → VERIFIED → COMPLETED', async () => {
      const trade = await tradesService.createFromOffer(
        uuidv4(), PARTY_A, PARTY_B, uuidv4(), uuidv4(),
        RiskLevel.MEDIUM, 0.43, {},
      );

      await tradesService.lockItems(trade.id, PARTY_A);

      // PartyA submits — still LOCKED (partyB hasn't submitted)
      const afterA = await tradesService.submitProof(trade.id, PARTY_A, proofItems('med-a'));
      expect(afterA.state).toBe(TradeState.LOCKED);
      expect(afterA.proofASubmitted).toBe(true);

      // PartyB submits — both submitted → PROOF_SUBMITTED
      const afterB = await tradesService.submitProof(trade.id, PARTY_B, proofItems('med-b'));
      expect(afterB.state).toBe(TradeState.PROOF_SUBMITTED);
      expect(afterB.proofBSubmitted).toBe(true);

      const underVerif = await tradesService.beginVerification(trade.id);
      expect(underVerif.state).toBe(TradeState.UNDER_VERIFICATION);

      const verified = await tradesService.verify(trade.id, MODERATOR);
      expect(verified.state).toBe(TradeState.VERIFIED);
      expect(verified.disputeWindowEnd).toBeDefined();

      const completed = await tradesService.completeTrade(trade.id);
      expect(completed.state).toBe(TradeState.COMPLETED);
    });

    it('duplicate proof submission by same party is idempotent — state does not regress', async () => {
      const trade = await tradesService.createFromOffer(
        uuidv4(), PARTY_A, PARTY_B, uuidv4(), uuidv4(),
        RiskLevel.MEDIUM, 0.43, {},
      );
      await tradesService.lockItems(trade.id, PARTY_A);

      await tradesService.submitProof(trade.id, PARTY_A, proofItems('dup-1'));
      const after2 = await tradesService.submitProof(trade.id, PARTY_A, proofItems('dup-2'));

      // Still LOCKED — partyB hasn't submitted; state must not regress
      expect(after2.state).toBe(TradeState.LOCKED);
      expect(after2.proofASubmitted).toBe(true);
      expect(after2.proofBSubmitted).toBe(false);

      // Both proof rows are stored
      const proofs = await dataSource.getRepository(ProofPackageEntity)
        .find({ where: { tradeId: trade.id } });
      expect(proofs.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── Dispute paths ────────────────────────────────────────────────────────────

  describe('Dispute paths', () => {
    async function setupVerifiedTrade() {
      const trade = await tradesService.createFromOffer(
        uuidv4(), PARTY_A, PARTY_B, uuidv4(), uuidv4(),
        RiskLevel.MEDIUM, 0.43, {},
      );
      await tradesService.lockItems(trade.id, PARTY_A);
      await tradesService.submitProof(trade.id, PARTY_A, proofItems('d-a'));
      await tradesService.submitProof(trade.id, PARTY_B, proofItems('d-b'));
      await tradesService.beginVerification(trade.id);
      await tradesService.verify(trade.id, MODERATOR);
      return trade;
    }

    it('VERIFIED → DISPUTE_OPEN → COMPLETED via dispute resolution', async () => {
      const trade = await setupVerifiedTrade();

      const disputed = await tradesService.openDispute(
        trade.id, PARTY_A, 'item_mismatch', 'Item does not match the listing.',
      );
      expect(disputed.state).toBe(TradeState.DISPUTE_OPEN);

      await tradesService.resolveFromDispute(trade.id, 'completed');

      const reloaded = await tradesService.findByUser(PARTY_A);
      expect(reloaded.find((t) => t.id === trade.id)!.state).toBe(TradeState.COMPLETED);
    });

    it('VERIFIED → DISPUTE_OPEN → REVOKED via dispute revocation', async () => {
      const trade = await setupVerifiedTrade();

      await tradesService.openDispute(trade.id, PARTY_A, 'counterfeit', 'Item is counterfeit.');
      await tradesService.resolveFromDispute(trade.id, 'revoked');

      const reloaded = await tradesService.findByUser(PARTY_A);
      expect(reloaded.find((t) => t.id === trade.id)!.state).toBe(TradeState.REVOKED);
    });
  });

  // ─── Cancel paths ─────────────────────────────────────────────────────────────

  describe('Cancel paths', () => {
    it('cancel from ACCEPTED', async () => {
      const trade = await tradesService.createFromOffer(
        uuidv4(), PARTY_A, PARTY_B, uuidv4(), uuidv4(),
        RiskLevel.MEDIUM, 0.43, {},
      );
      const cancelled = await tradesService.cancelTrade(trade.id, PARTY_A);
      expect(cancelled.state).toBe(TradeState.CANCELLED);
      expect(cancelled.cancelledAt).toBeDefined();
    });

    it('cancel from LOCKED', async () => {
      const trade = await tradesService.createFromOffer(
        uuidv4(), PARTY_A, PARTY_B, uuidv4(), uuidv4(),
        RiskLevel.MEDIUM, 0.43, {},
      );
      await tradesService.lockItems(trade.id, PARTY_A);
      const cancelled = await tradesService.cancelTrade(trade.id, PARTY_A);
      expect(cancelled.state).toBe(TradeState.CANCELLED);
    });

    it('cancel from PROOF_SUBMITTED', async () => {
      const trade = await tradesService.createFromOffer(
        uuidv4(), PARTY_A, PARTY_B, uuidv4(), uuidv4(),
        RiskLevel.MEDIUM, 0.43, {},
      );
      await tradesService.lockItems(trade.id, PARTY_A);
      await tradesService.submitProof(trade.id, PARTY_A, proofItems('cps-a'));
      await tradesService.submitProof(trade.id, PARTY_B, proofItems('cps-b'));
      // Now in PROOF_SUBMITTED
      const cancelled = await tradesService.cancelTrade(trade.id, PARTY_A);
      expect(cancelled.state).toBe(TradeState.CANCELLED);
    });

    it('cancel from UNDER_VERIFICATION', async () => {
      const trade = await tradesService.createFromOffer(
        uuidv4(), PARTY_A, PARTY_B, uuidv4(), uuidv4(),
        RiskLevel.MEDIUM, 0.43, {},
      );
      await tradesService.lockItems(trade.id, PARTY_A);
      await tradesService.submitProof(trade.id, PARTY_A, proofItems('cuv-a'));
      await tradesService.submitProof(trade.id, PARTY_B, proofItems('cuv-b'));
      await tradesService.beginVerification(trade.id);
      const cancelled = await tradesService.cancelTrade(trade.id, PARTY_A);
      expect(cancelled.state).toBe(TradeState.CANCELLED);
    });
  });

  // ─── Lock contention ──────────────────────────────────────────────────────────

  describe('Lock contention', () => {
    it('second lockItems on a shared listing throws ConflictException', async () => {
      const sharedListing = uuidv4();

      const trade1 = await tradesService.createFromOffer(
        uuidv4(), PARTY_A, PARTY_B, sharedListing, uuidv4(),
        RiskLevel.MEDIUM, 0.43, {},
      );
      const trade2 = await tradesService.createFromOffer(
        uuidv4(), PARTY_C, PARTY_D, sharedListing, uuidv4(),
        RiskLevel.MEDIUM, 0.43, {},
      );

      // trade1 locks sharedListing
      await tradesService.lockItems(trade1.id, PARTY_A);
      const reloaded1 = await tradesService.findByUser(PARTY_A);
      expect(reloaded1.find((t) => t.id === trade1.id)!.state).toBe(TradeState.LOCKED);

      // trade2 fails — sharedListing is held by trade1
      await expect(tradesService.lockItems(trade2.id, PARTY_C)).rejects.toThrow(ConflictException);

      const reloaded2 = await tradesService.findByUser(PARTY_C);
      expect(reloaded2.find((t) => t.id === trade2.id)!.state).toBe(TradeState.ACCEPTED);
    });
  });

  // ─── Timeout scheduler ────────────────────────────────────────────────────────

  describe('Timeout scheduler', () => {
    it('auto-cancels ACCEPTED trade with expired timeoutAt', async () => {
      const trade = await tradesService.createFromOffer(
        uuidv4(), PARTY_A, PARTY_B, uuidv4(), uuidv4(),
        RiskLevel.MEDIUM, 0.43, {},
      );

      await dataSource.query(
        `UPDATE trades SET timeout_at = NOW() - INTERVAL '1 second' WHERE id = $1`,
        [trade.id],
      );

      await scheduler.handleTimeouts();

      const reloaded = await tradesService.findByUser(PARTY_A);
      expect(reloaded.find((t) => t.id === trade.id)!.state).toBe(TradeState.CANCELLED);
    });

    it('auto-completes VERIFIED trade with expired dispute window', async () => {
      const trade = await tradesService.createFromOffer(
        uuidv4(), PARTY_A, PARTY_B, uuidv4(), uuidv4(),
        RiskLevel.MEDIUM, 0.43, {},
      );
      await tradesService.lockItems(trade.id, PARTY_A);
      await tradesService.submitProof(trade.id, PARTY_A, proofItems('sched-a'));
      await tradesService.submitProof(trade.id, PARTY_B, proofItems('sched-b'));
      await tradesService.beginVerification(trade.id);
      await tradesService.verify(trade.id, MODERATOR);

      await dataSource.query(
        `UPDATE trades
         SET timeout_at = NOW() - INTERVAL '1 second',
             dispute_window_end = NOW() - INTERVAL '1 second'
         WHERE id = $1`,
        [trade.id],
      );

      await scheduler.handleTimeouts();

      const reloaded = await tradesService.findByUser(PARTY_A);
      expect(reloaded.find((t) => t.id === trade.id)!.state).toBe(TradeState.COMPLETED);
    });

    it('leaves trade untouched when timeoutAt is in the future', async () => {
      const trade = await tradesService.createFromOffer(
        uuidv4(), PARTY_A, PARTY_B, uuidv4(), uuidv4(),
        RiskLevel.MEDIUM, 0.43, {},
      );
      // Default timeoutAt = now + 48h (MEDIUM) — no change needed

      await scheduler.handleTimeouts();

      const reloaded = await tradesService.findByUser(PARTY_A);
      expect(reloaded.find((t) => t.id === trade.id)!.state).toBe(TradeState.ACCEPTED);
    });

    it('does not process already-terminal (CANCELLED) trades', async () => {
      const trade = await tradesService.createFromOffer(
        uuidv4(), PARTY_A, PARTY_B, uuidv4(), uuidv4(),
        RiskLevel.MEDIUM, 0.43, {},
      );
      await tradesService.cancelTrade(trade.id, PARTY_A);

      await dataSource.query(
        `UPDATE trades SET timeout_at = NOW() - INTERVAL '1 second' WHERE id = $1`,
        [trade.id],
      );

      const cancelSpy = jest.spyOn(tradesService, 'cancelTrade');
      await scheduler.handleTimeouts();
      expect(cancelSpy).not.toHaveBeenCalled();
    });
  });

  // ─── Outbox entries ───────────────────────────────────────────────────────────

  describe('Outbox entries', () => {
    it('createFromOffer writes a trade.initiated outbox entry', async () => {
      const trade = await tradesService.createFromOffer(
        uuidv4(), PARTY_A, PARTY_B, uuidv4(), uuidv4(),
        RiskLevel.LOW, 0.15, {},
      );

      const outbox = await dataSource.getRepository(OutboxEntity)
        .find({ where: { aggregateId: trade.id } });

      expect(outbox.some((e) => (e.eventType as string).includes('trade.initiated'))).toBe(true);
    });

    it('lockItems writes a trade.locked outbox entry', async () => {
      const trade = await tradesService.createFromOffer(
        uuidv4(), PARTY_A, PARTY_B, uuidv4(), uuidv4(),
        RiskLevel.LOW, 0.15, {},
      );
      await tradesService.lockItems(trade.id, PARTY_A);

      const outbox = await dataSource.getRepository(OutboxEntity)
        .find({ where: { aggregateId: trade.id } });

      expect(outbox.some((e) => (e.eventType as string).includes('trade.locked'))).toBe(true);
    });
  });
});
