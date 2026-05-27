import { Injectable, Logger, NotFoundException, ForbiddenException, OnModuleInit, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { TradeEntity } from './trade.entity';
import { TradeEventEntity } from './trade-event.entity';
import { ProofPackageEntity } from './proof-package.entity';
import { TradeState, RiskLevel, QUEUES, ROUTING_KEYS } from '@exchange/shared-types';
import { TradeStateMachine } from '../state-machine/trade-state-machine';
import { OutboxService, RabbitMQService } from '@exchange/common';
import { RiskAssessorService } from '../risk/risk-assessor.service';
import { ExternalDataService } from '../risk/external-data.service';
import { TimeWindowService } from '../escrow/time-window.service';
import { LockService } from '../escrow/lock.service';
import { CenterVerificationEntity } from '../centers/center-verification.entity';
import { VerificationCenterEntity } from '../centers/verification-center.entity';
import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { ImageHashService } from '../proofs/image-hash.service';

@Injectable()
export class TradesService implements OnModuleInit {
  private readonly logger = new Logger(TradesService.name);

  constructor(
    @InjectRepository(TradeEntity)
    private readonly tradeRepo: Repository<TradeEntity>,
    @InjectRepository(TradeEventEntity)
    private readonly eventRepo: Repository<TradeEventEntity>,
    @InjectRepository(ProofPackageEntity)
    private readonly proofRepo: Repository<ProofPackageEntity>,
    @InjectRepository(CenterVerificationEntity)
    private readonly centerVerificationRepo: Repository<CenterVerificationEntity>,
    @InjectRepository(VerificationCenterEntity)
    private readonly centerRepo: Repository<VerificationCenterEntity>,
    private readonly stateMachine: TradeStateMachine,
    private readonly outboxService: OutboxService,
    private readonly dataSource: DataSource,
    private readonly rabbitMQService: RabbitMQService,
    private readonly riskAssessor: RiskAssessorService,
    private readonly externalData: ExternalDataService,
    private readonly timeWindow: TimeWindowService,
    private readonly lockService: LockService,
    private readonly imageHashService: ImageHashService,
  ) {}

  async onModuleInit() {
    await this.rabbitMQService.subscribe(
      QUEUES.TRADE_ON_OFFER,
      [ROUTING_KEYS.OFFER.ACCEPTED],
      async (msg: Record<string, unknown>) => {
        const { offerId, listingId, offeredListingId, partyAId, partyBId } = msg as {
          offerId: string;
          listingId: string;
          offeredListingId: string;
          partyAId: string;
          partyBId: string;
        };

        // Fetch real risk inputs from listing-service, user-service, and dispute-service
        const [listingA, trustA, trustB, disputeCountA, disputeCountB] = await Promise.all([
          this.externalData.getListingDetails(listingId),
          this.externalData.getUserTrustScore(partyAId),
          this.externalData.getUserTrustScore(partyBId),
          this.externalData.getUserDisputeCount(partyAId),
          this.externalData.getUserDisputeCount(partyBId),
        ]);

        const categoryWeight = listingA.categoryId
          ? await this.externalData.getCategoryRiskWeight(listingA.categoryId)
          : 0.5;

        const risk = this.riskAssessor.assess({
          categoryRiskWeight: categoryWeight,
          trustScore: Math.min(trustA, trustB), // worst of the two parties
          disputeCount: Math.max(disputeCountA, disputeCountB), // worst of the two
        });

        // Velocity check: limit active trades based on trust score
        await this.checkVelocityLimit(partyAId, trustA);
        await this.checkVelocityLimit(partyBId, trustB);

        await this.createFromOffer(
          offerId, partyAId, partyBId, listingId, offeredListingId,
          risk.riskLevel, risk.riskScore,
          risk.factors as unknown as Record<string, unknown>,
        );
        this.logger.log(`Trade created from offer ${offerId} — risk: ${risk.riskLevel} (${risk.riskScore})`);
      },
    );

    await this.rabbitMQService.subscribe(
      QUEUES.TRADE_ON_DISPUTE,
      [ROUTING_KEYS.DISPUTE.RESOLVED],
      async (msg: Record<string, unknown>) => {
        const { tradeId, outcome } = msg as { tradeId: string; outcome: string };
        await this.resolveFromDispute(tradeId, outcome);
      },
    );

    // Subscribe to payment events (skip boost payments that have no tradeId)
    await this.rabbitMQService.subscribe(
      QUEUES.TRADE_ON_PAYMENT,
      [ROUTING_KEYS.PAYMENT.SUCCEEDED],
      async (msg: Record<string, unknown>) => {
        const { tradeId, userId, type, allUserPaymentsComplete } = msg as {
          tradeId: string;
          userId: string;
          type?: string;
          allUserPaymentsComplete?: boolean;
        };
        if (!tradeId) {
          this.logger.log(`Skipping non-trade payment event (no tradeId)`);
          return;
        }
        this.logger.log(`Payment succeeded for trade ${tradeId}, user ${userId}, type=${type}, allComplete=${allUserPaymentsComplete}`);
        await this.handlePaymentSucceeded(tradeId, userId, type, allUserPaymentsComplete);
      },
    );

    // Subscribe to shipping events (leg-aware for center model)
    await this.rabbitMQService.subscribe(
      QUEUES.TRADE_ON_SHIPPING,
      [ROUTING_KEYS.SHIPPING.LABEL_CREATED, ROUTING_KEYS.SHIPPING.IN_TRANSIT, ROUTING_KEYS.SHIPPING.DELIVERED],
      async (msg: Record<string, unknown>, routingKey: string) => {
        const { tradeId, allLabelsReady, leg } = msg as { tradeId: string; allLabelsReady?: boolean; leg?: string };
        this.logger.log(`Received shipping event: ${routingKey} for trade ${tradeId} (leg=${leg || 'unknown'})`);

        if (allLabelsReady && routingKey?.includes('label')) {
          if (leg === 'direct') {
            await this.handleDirectShippingReady(tradeId);
          } else {
            await this.handleShippingReady(tradeId);
          }
        } else if (routingKey?.includes('in_transit')) {
          if (leg === 'to_recipient') {
            await this.handleLeg2InTransit(tradeId);
          } else if (leg === 'direct') {
            this.logger.log(`Direct shipping in transit for trade ${tradeId}`);
          } else {
            // Leg 1 in-transit: no state change needed, just log
            this.logger.log(`Leg 1 in transit for trade ${tradeId}`);
          }
        } else if (routingKey?.includes('delivered')) {
          if (leg === 'to_recipient') {
            await this.handleLeg2Delivered(tradeId);
          } else if (leg === 'direct') {
            await this.handleDirectShipmentDelivered(tradeId);
          }
          // Leg 1 delivered is handled via center.item_received event
        }
      },
    );

    // Subscribe to center verification events
    await this.rabbitMQService.subscribe(
      QUEUES.TRADE_ON_CENTER,
      [ROUTING_KEYS.CENTER.ITEM_RECEIVED, ROUTING_KEYS.CENTER.VERIFICATION_APPROVED, ROUTING_KEYS.CENTER.VERIFICATION_REJECTED, ROUTING_KEYS.CENTER.BOTH_VERIFIED],
      async (msg: Record<string, unknown>, routingKey: string) => {
        const { tradeId, party } = msg as { tradeId: string; party: string };
        this.logger.log(`Received center event: ${routingKey} for trade ${tradeId}, party=${party}`);

        if (routingKey === ROUTING_KEYS.CENTER.ITEM_RECEIVED) {
          await this.handleItemAtCenter(tradeId, party);
        } else if (routingKey === ROUTING_KEYS.CENTER.VERIFICATION_APPROVED) {
          await this.handleCenterVerificationApproved(tradeId, party);
        } else if (routingKey === ROUTING_KEYS.CENTER.VERIFICATION_REJECTED) {
          const reason = (msg.reason as string) || 'Item rejected at center';
          await this.handleCenterVerificationRejected(tradeId, party, reason);
        } else if (routingKey === ROUTING_KEYS.CENTER.BOTH_VERIFIED) {
          await this.handleBothCenterVerified(tradeId);
        }
      },
    );

    // Subscribe to dispute ship-to-center events
    await this.rabbitMQService.subscribe(
      QUEUES.TRADE_ON_DISPUTE_CENTER,
      [ROUTING_KEYS.DISPUTE.SHIP_TO_CENTER],
      async (msg: Record<string, unknown>) => {
        const { tradeId, centerId } = msg as { tradeId: string; centerId: string };
        this.logger.log(`Dispute ship-to-center for trade ${tradeId}, center ${centerId}`);
        await this.handleDisputeShipToCenter(tradeId, centerId);
      },
    );
  }

  private async checkVelocityLimit(userId: string, trustScore: number): Promise<void> {
    const activeTrades = await this.tradeRepo.count({
      where: [
        { partyAId: userId, state: TradeState.ACCEPTED },
        { partyAId: userId, state: TradeState.LOCKED },
        { partyAId: userId, state: TradeState.PROOF_SUBMITTED },
        { partyAId: userId, state: TradeState.UNDER_VERIFICATION },
        { partyAId: userId, state: TradeState.VERIFIED },
        { partyAId: userId, state: TradeState.AWAITING_SHIPMENT },
        { partyAId: userId, state: TradeState.IN_TRANSIT },
        { partyBId: userId, state: TradeState.ACCEPTED },
        { partyBId: userId, state: TradeState.LOCKED },
        { partyBId: userId, state: TradeState.PROOF_SUBMITTED },
        { partyBId: userId, state: TradeState.UNDER_VERIFICATION },
        { partyBId: userId, state: TradeState.VERIFIED },
        { partyBId: userId, state: TradeState.AWAITING_SHIPMENT },
        { partyBId: userId, state: TradeState.IN_TRANSIT },
      ],
    });

    let maxActive: number;
    if (trustScore < 50) maxActive = 50;
    else if (trustScore < 80) maxActive = 100;
    else maxActive = 200;

    if (activeTrades >= maxActive) {
      throw new ForbiddenException(
        `Active trade limit reached (${activeTrades}/${maxActive}). Complete existing trades or build trust score.`,
      );
    }
  }

  async createFromOffer(
    offerId: string,
    partyAId: string,
    partyBId: string,
    listingAId: string,
    listingBId: string,
    riskLevel: RiskLevel,
    riskScore: number,
    riskFactors: Record<string, unknown>,
  ): Promise<TradeEntity> {
    return this.dataSource.transaction(async (manager) => {
      // Trade is created from an already-accepted offer, so it starts at ACCEPTED
      // (the INITIATED→OFFERED→ACCEPTED negotiation happened in offer-service)
      const trade = manager.create(TradeEntity, {
        offerId, partyAId, partyBId, listingAId, listingBId,
        state: TradeState.ACCEPTED,
        riskLevel, riskScore, riskFactors,
        timeoutAt: this.timeWindow.calculateStepTimeout(riskLevel),
      });
      const saved = await manager.save(trade);

      await manager.save(TradeEventEntity, {
        tradeId: saved.id,
        eventType: 'trade.initiated',
        toState: TradeState.ACCEPTED,
        payload: { offerId, riskLevel, riskScore },
      });

      await this.outboxService.addToOutbox(manager, 'trade', saved.id, ROUTING_KEYS.TRADE.INITIATED, {
        tradeId: saved.id, offerId, partyAId, partyBId, listingAId, listingBId, riskLevel, riskScore,
      });

      return saved;
    });
  }

  async lockItems(tradeId: string, userId: string): Promise<TradeEntity> {
    const trade = await this.findOneForUser(tradeId, userId);

    const result = this.stateMachine.transition(trade, 'items_locked', userId);
    if (!result.success) throw new ForbiddenException(result.reason);

    return this.dataSource.transaction(async (manager) => {
      const lockA = await this.lockService.acquireLock(manager, tradeId, trade.listingAId, userId);
      const lockB = await this.lockService.acquireLock(manager, tradeId, trade.listingBId, userId);

      if (!lockA || !lockB) {
        if (lockA) await this.lockService.releaseLock(manager, tradeId, trade.listingAId);
        throw new ConflictException('Could not acquire locks on both listings');
      }

      trade.state = result.newState!;
      trade.lockedAt = new Date();
      trade.timeoutAt = this.timeWindow.calculateStepTimeout(trade.riskLevel);
      const saved = await manager.save(trade);

      await manager.save(TradeEventEntity, {
        tradeId, eventType: 'trade.locked',
        fromState: result.fromState, toState: result.newState,
        payload: { lockedBy: userId }, triggeredBy: userId,
      });

      await this.outboxService.addToOutbox(manager, 'trade', tradeId, ROUTING_KEYS.TRADE.LOCKED, {
        tradeId, partyAId: trade.partyAId, partyBId: trade.partyBId,
        listingAId: trade.listingAId, listingBId: trade.listingBId, riskLevel: trade.riskLevel,
      });

      return saved;
    });
  }

  async submitProof(
    tradeId: string,
    userId: string,
    items: Array<{ type: string; url: string; hash: string }>,
    metadata?: Record<string, unknown>,
  ): Promise<TradeEntity> {
    const trade = await this.findOneForUser(tradeId, userId);

    // Anti-scam: ALL trades require at least one video proof
    const hasVideo = items.some((item) => item.type === 'video');
    if (!hasVideo) {
      throw new ForbiddenException('Video proof is required. Please include at least one video showing the item.');
    }

    const packageHash = createHash('sha256')
      .update(items.map((i) => i.hash).join(''))
      .digest('hex');

    // Anti-scam: check for duplicate images AND videos across trades
    const duplicateWarnings: Array<{ fileName: string; duplicateOfTradeId: string; distance: number }> = [];
    if (metadata?.uploadResults && Array.isArray(metadata.uploadResults)) {
      for (const upload of metadata.uploadResults as Array<{ phash?: string; hash?: string; originalName?: string; mimeType?: string }>) {
        if (upload.hash) {
          // For images with phash: perceptual + exact match
          // For videos (no phash): SHA256 exact match only
          const phashToUse = upload.phash || upload.hash; // use SHA256 as placeholder phash for videos
          const dupResult = await this.imageHashService.storeAndCheckDuplicate(
            phashToUse, upload.hash, tradeId, userId, upload.originalName || 'unknown',
          );
          if (dupResult.isDuplicate) {
            duplicateWarnings.push({
              fileName: upload.originalName || 'unknown',
              duplicateOfTradeId: dupResult.duplicateOfTradeId!,
              distance: dupResult.distance ?? 0,
            });
          }
        }
      }
    }

    // Publish fraud event when duplicates are detected
    if (duplicateWarnings.length > 0) {
      await this.rabbitMQService.publish(ROUTING_KEYS.TRADE.DUPLICATE_PROOF_DETECTED, {
        eventId: uuidv4(),
        timestamp: new Date().toISOString(),
        tradeId,
        userId,
        duplicateWarnings,
      });
      this.logger.warn(`Duplicate proof detected in trade ${tradeId} by user ${userId}: ${duplicateWarnings.length} file(s)`);
    }

    const enrichedMetadata = {
      ...(metadata || {}),
      ...(duplicateWarnings.length > 0 ? { duplicateWarnings } : {}),
    };

    return this.dataSource.transaction(async (manager) => {
      await manager.save(ProofPackageEntity, { tradeId, userId, items, packageHash, metadata: enrichedMetadata });

      if (userId === trade.partyAId) trade.proofASubmitted = true;
      else trade.proofBSubmitted = true;

      const bothSubmitted = trade.proofASubmitted && trade.proofBSubmitted;

      // ALL trades require both parties to submit proof — no auto-verify bypass
      if (bothSubmitted) {
        const smResult = this.stateMachine.transition(trade, 'proof_submitted', userId);
        if (smResult.success) {
          trade.state = smResult.newState!;
        }
      }

      trade.timeoutAt = this.timeWindow.calculateStepTimeout(trade.riskLevel);
      const saved = await manager.save(trade);

      await manager.save(TradeEventEntity, {
        tradeId, eventType: 'trade.proof_submitted',
        fromState: TradeState.LOCKED, toState: saved.state,
        payload: { userId, packageHash }, triggeredBy: userId,
      });

      await this.outboxService.addToOutbox(manager, 'trade', tradeId, ROUTING_KEYS.TRADE.PROOF_SUBMITTED, {
        tradeId, userId, packageHash,
      });

      return saved;
    });
  }

  async beginVerification(tradeId: string): Promise<TradeEntity> {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) throw new NotFoundException('Trade not found');

    const result = this.stateMachine.transition(trade, 'begin_verification', 'system');
    if (!result.success) throw new ForbiddenException(result.reason);

    return this.dataSource.transaction(async (manager) => {
      trade.state = result.newState!;
      trade.timeoutAt = this.timeWindow.calculateStepTimeout(trade.riskLevel);
      const saved = await manager.save(trade);

      await manager.save(TradeEventEntity, {
        tradeId, eventType: 'trade.verification_started',
        fromState: result.fromState, toState: result.newState,
        payload: { riskLevel: trade.riskLevel },
      });

      return saved;
    });
  }

  async verify(tradeId: string, verifierId: string): Promise<TradeEntity> {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) throw new NotFoundException('Trade not found');

    const result = this.stateMachine.transition(trade, 'verified', verifierId);
    if (!result.success) throw new ForbiddenException(result.reason);

    return this.dataSource.transaction(async (manager) => {
      trade.state = result.newState!;
      trade.disputeWindowEnd = this.timeWindow.calculateDisputeWindowEnd(trade.riskLevel);
      trade.timeoutAt = trade.disputeWindowEnd;
      const saved = await manager.save(trade);

      await manager.save(TradeEventEntity, {
        tradeId, eventType: 'trade.verified',
        fromState: result.fromState, toState: result.newState,
        payload: { verifiedBy: verifierId }, triggeredBy: verifierId,
      });

      const allProofs = await manager.find(ProofPackageEntity, { where: { tradeId } });
      const proofA = allProofs.find(p => p.userId === trade.partyAId);
      const proofB = allProofs.find(p => p.userId === trade.partyBId);
      await this.outboxService.addToOutbox(manager, 'trade', tradeId, ROUTING_KEYS.TRADE.VERIFIED, {
        tradeId, riskLevel: trade.riskLevel,
        partyAId: trade.partyAId, partyBId: trade.partyBId,
        listingAId: trade.listingAId, listingBId: trade.listingBId,
        proofHashA: proofA?.packageHash ?? null,
        proofHashB: proofB?.packageHash ?? null,
        disputeWindowEnd: trade.disputeWindowEnd.toISOString(),
      });

      return saved;
    });
  }

  async rejectVerification(tradeId: string, moderatorId: string, reason: string): Promise<TradeEntity> {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) throw new NotFoundException('Trade not found');

    const result = this.stateMachine.transition(trade, 'verification_rejected', moderatorId);
    if (!result.success) throw new ForbiddenException(result.reason);

    return this.dataSource.transaction(async (manager) => {
      trade.state = result.newState!;
      trade.proofASubmitted = false;
      trade.proofBSubmitted = false;
      trade.timeoutAt = this.timeWindow.calculateStepTimeout(trade.riskLevel);
      const saved = await manager.save(trade);

      await manager.save(TradeEventEntity, {
        tradeId,
        eventType: 'trade.verification_rejected',
        fromState: result.fromState,
        toState: result.newState,
        payload: { rejectedBy: moderatorId, reason },
        triggeredBy: moderatorId,
      });

      return saved;
    });
  }

  async getProofPackages(tradeId: string): Promise<ProofPackageEntity[]> {
    return this.proofRepo.find({
      where: { tradeId },
      order: { submittedAt: 'ASC' },
    });
  }

  async completeTrade(tradeId: string): Promise<TradeEntity> {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) throw new NotFoundException('Trade not found');

    const result = this.stateMachine.transition(trade, 'dispute_window_expired', 'system');
    if (!result.success) throw new ForbiddenException(result.reason);

    return this.dataSource.transaction(async (manager) => {
      trade.state = result.newState!;
      trade.completedAt = new Date();
      const saved = await manager.save(trade);

      await manager.save(TradeEventEntity, {
        tradeId, eventType: 'trade.completed',
        fromState: result.fromState, toState: result.newState,
        payload: { completedAt: trade.completedAt },
      });

      await this.outboxService.addToOutbox(manager, 'trade', tradeId, ROUTING_KEYS.TRADE.COMPLETED, {
        tradeId, partyAId: trade.partyAId, partyBId: trade.partyBId,
        listingAId: trade.listingAId, listingBId: trade.listingBId,
        riskLevel: trade.riskLevel,
        duration: trade.completedAt.getTime() - trade.createdAt.getTime(),
      });

      return saved;
    });
  }

  async confirmReceipt(tradeId: string, userId: string): Promise<TradeEntity> {
    const trade = await this.findOneForUser(tradeId, userId);

    if (trade.state !== TradeState.DELIVERED) {
      throw new ForbiddenException('Can only confirm receipt in DELIVERED state');
    }

    // Track which party confirmed
    if (userId === trade.partyAId) trade.partyAConfirmedReceipt = true;
    else trade.partyBConfirmedReceipt = true;

    // Both must confirm for early completion
    if (!trade.partyAConfirmedReceipt || !trade.partyBConfirmedReceipt) {
      const saved = await this.tradeRepo.save(trade);
      this.logger.log(`Receipt confirmed by ${userId} for trade ${tradeId} (waiting for other party)`);
      return saved;
    }

    const result = this.stateMachine.transition(trade, 'buyer_confirmed_receipt', userId);
    if (!result.success) throw new ForbiddenException(result.reason);

    return this.dataSource.transaction(async (manager) => {
      trade.state = result.newState!;
      trade.completedAt = new Date();
      const saved = await manager.save(trade);

      await manager.save(TradeEventEntity, {
        tradeId, eventType: 'trade.receipt_confirmed',
        fromState: result.fromState, toState: result.newState,
        payload: { confirmedBy: userId }, triggeredBy: userId,
      });

      await this.outboxService.addToOutbox(manager, 'trade', tradeId, ROUTING_KEYS.TRADE.COMPLETED, {
        tradeId, partyAId: trade.partyAId, partyBId: trade.partyBId,
        listingAId: trade.listingAId, listingBId: trade.listingBId,
        riskLevel: trade.riskLevel,
        completionType: 'receipt_confirmed',
      });

      return saved;
    });
  }

  async openDispute(tradeId: string, userId: string, reason?: string, description?: string): Promise<TradeEntity> {
    const trade = await this.findOneForUser(tradeId, userId);
    const result = this.stateMachine.transition(trade, 'dispute_opened', userId);
    if (!result.success) throw new ForbiddenException(result.reason);

    return this.dataSource.transaction(async (manager) => {
      trade.state = result.newState!;
      const saved = await manager.save(trade);

      await manager.save(TradeEventEntity, {
        tradeId, eventType: 'trade.dispute_opened',
        fromState: result.fromState, toState: result.newState,
        payload: { openedBy: userId, reason, description }, triggeredBy: userId,
      });

      await this.outboxService.addToOutbox(manager, 'trade', tradeId, ROUTING_KEYS.TRADE.DISPUTE_OPENED, {
        tradeId, openedBy: userId, partyAId: trade.partyAId, partyBId: trade.partyBId,
        reason: reason ?? 'other', description,
      });

      return saved;
    });
  }

  async resolveFromDispute(tradeId: string, outcome: string): Promise<void> {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) return;

    const event = outcome === 'revoked' ? 'trade_revoked' : 'dispute_resolved';
    const result = this.stateMachine.transition(trade, event, 'system');
    if (!result.success) return;

    await this.dataSource.transaction(async (manager) => {
      trade.state = result.newState!;
      if (outcome === 'completed') trade.completedAt = new Date();
      await manager.save(trade);

      await manager.save(TradeEventEntity, {
        tradeId, eventType: `trade.${outcome}`,
        fromState: result.fromState, toState: result.newState,
        payload: { outcome, resolvedBy: 'dispute-service' },
      });

      const routingKey = outcome === 'revoked' ? ROUTING_KEYS.TRADE.CANCELLED : ROUTING_KEYS.TRADE.COMPLETED;
      await this.outboxService.addToOutbox(manager, 'trade', tradeId, routingKey, {
        tradeId, outcome,
        partyAId: trade.partyAId, partyBId: trade.partyBId,
        listingAId: trade.listingAId, listingBId: trade.listingBId,
        riskLevel: trade.riskLevel,
      });
    });
  }

  // --- Shipping flow methods ---

  async setShippingMethod(tradeId: string, userId: string, method: 'shipping' | 'local_pickup'): Promise<TradeEntity> {
    const trade = await this.findOneForUser(tradeId, userId);
    if (trade.state !== TradeState.VERIFIED) {
      throw new ForbiddenException('Shipping method can only be set in VERIFIED state');
    }
    trade.shippingMethod = method;
    return this.tradeRepo.save(trade);
  }

  async selectCenter(tradeId: string, userId: string, centerId: string): Promise<TradeEntity> {
    const trade = await this.findOneForUser(tradeId, userId);
    if (trade.state !== TradeState.VERIFIED) {
      throw new ForbiddenException('Center can only be selected in VERIFIED state');
    }
    if (trade.riskLevel !== RiskLevel.HIGH) {
      throw new ForbiddenException('Center selection is only available for high-risk trades');
    }

    const center = await this.centerRepo.findOne({ where: { id: centerId, isActive: true } });
    if (!center) {
      throw new NotFoundException('Verification center not found or inactive');
    }

    if (userId === trade.partyAId) {
      trade.centerAId = centerId;
    } else {
      trade.centerBId = centerId;
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const s = await manager.save(trade);
      await manager.save(TradeEventEntity, {
        tradeId,
        eventType: 'trade.center_selected',
        fromState: trade.state,
        toState: trade.state,
        payload: { userId, centerId, centerName: center.name },
        triggeredBy: userId,
      });
      return s;
    });

    // Check if all prerequisites met to publish addresses_ready
    await this.checkAndPublishAddressesReady(saved);

    return saved;
  }

  async submitAddress(tradeId: string, userId: string, address: Record<string, string>): Promise<TradeEntity> {
    const trade = await this.findOneForUser(tradeId, userId);
    if (trade.state !== TradeState.VERIFIED && trade.state !== TradeState.AWAITING_SHIPMENT) {
      throw new ForbiddenException('Address can only be submitted in VERIFIED or AWAITING_SHIPMENT state');
    }

    if (!trade.shippingMethod) {
      trade.shippingMethod = 'shipping';
    }

    if (userId === trade.partyAId) {
      trade.partyAAddressSubmitted = true;
      trade.partyAAddress = address;
    } else {
      trade.partyBAddressSubmitted = true;
      trade.partyBAddress = address;
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const s = await manager.save(trade);

      await manager.save(TradeEventEntity, {
        tradeId,
        eventType: 'trade.address_submitted',
        fromState: trade.state,
        toState: trade.state,
        payload: { userId, address },
        triggeredBy: userId,
      });

      return s;
    });

    // Check if all prerequisites met to publish addresses_ready
    await this.checkAndPublishAddressesReady(saved);

    return saved;
  }

  private async checkAndPublishAddressesReady(trade: TradeEntity): Promise<void> {
    if (
      !trade.partyAAddressSubmitted || !trade.partyBAddressSubmitted ||
      !trade.partyAAddress || !trade.partyBAddress
    ) return;

    // For HIGH risk shipping trades, both centers must be selected
    if (trade.shippingMethod === 'shipping' && trade.riskLevel === RiskLevel.HIGH && (!trade.centerAId || !trade.centerBId)) {
      this.logger.log(`Waiting for both centers to be selected for HIGH-risk trade ${trade.id}`);
      return;
    }

    // Fetch center addresses for the shipping service
    let centerAAddress: Record<string, string> | undefined;
    let centerBAddress: Record<string, string> | undefined;
    if (trade.centerAId && trade.centerBId) {
      const [centerA, centerB] = await Promise.all([
        this.centerRepo.findOne({ where: { id: trade.centerAId } }),
        this.centerRepo.findOne({ where: { id: trade.centerBId } }),
      ]);
      if (centerA) {
        centerAAddress = {
          name: centerA.contactName,
          street: centerA.street,
          city: centerA.city,
          state: centerA.city,
          postalCode: centerA.postalCode,
          country: centerA.country,
          phone: centerA.phone,
          district: centerA.district,
        };
      }
      if (centerB) {
        centerBAddress = {
          name: centerB.contactName,
          street: centerB.street,
          city: centerB.city,
          state: centerB.city,
          postalCode: centerB.postalCode,
          country: centerB.country,
          phone: centerB.phone,
          district: centerB.district,
        };
      }
    }

    this.logger.log(`All prerequisites met for trade ${trade.id}, publishing addresses_ready event`);
    await this.rabbitMQService.publish(ROUTING_KEYS.SHIPPING.ADDRESSES_READY, {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      tradeId: trade.id,
      partyAId: trade.partyAId,
      partyBId: trade.partyBId,
      listingAId: trade.listingAId,
      listingBId: trade.listingBId,
      partyAAddress: trade.partyAAddress,
      partyBAddress: trade.partyBAddress,
      centerAId: trade.centerAId,
      centerBId: trade.centerBId,
      centerAAddress,
      centerBAddress,
    });
  }

  async confirmLocalPickup(tradeId: string, userId: string): Promise<TradeEntity> {
    const trade = await this.findOneForUser(tradeId, userId);
    if (trade.state !== TradeState.VERIFIED) {
      throw new ForbiddenException('Local pickup can only be confirmed in VERIFIED state');
    }

    if (!trade.shippingMethod) {
      trade.shippingMethod = 'local_pickup';
    }

    if (userId === trade.partyAId) {
      trade.partyALocalPickupConfirmed = true;
    } else {
      trade.partyBLocalPickupConfirmed = true;
    }

    // Save the confirmation first
    const saved = await this.dataSource.transaction(async (manager) => {
      const s = await manager.save(trade);
      await manager.save(TradeEventEntity, {
        tradeId,
        eventType: 'trade.local_pickup_partial',
        fromState: trade.state,
        toState: trade.state,
        payload: { confirmedBy: userId },
        triggeredBy: userId,
      });
      return s;
    });

    // Attempt full transition if all conditions met (both confirmed + both paid)
    const completed = await this.completeLocalPickup(tradeId, userId);
    return completed || saved;
  }

  private async completeLocalPickup(tradeId: string, triggeredBy: string): Promise<TradeEntity | null> {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade || trade.state !== TradeState.VERIFIED) return null;
    if (!trade.partyALocalPickupConfirmed || !trade.partyBLocalPickupConfirmed) return null;
    if (!trade.partyAPaid || !trade.partyBPaid) return null;

    const result = this.stateMachine.transition(trade, 'local_pickup_confirmed', triggeredBy);
    if (!result.success) return null;

    return this.dataSource.transaction(async (manager) => {
      trade.state = result.newState!;
      trade.disputeWindowEnd = this.timeWindow.calculateDisputeWindowEnd(trade.riskLevel);
      trade.timeoutAt = trade.disputeWindowEnd;
      const saved = await manager.save(trade);

      await manager.save(TradeEventEntity, {
        tradeId,
        eventType: 'trade.local_pickup_confirmed',
        fromState: result.fromState,
        toState: result.newState,
        payload: { confirmedBy: triggeredBy },
        triggeredBy,
      });

      this.logger.log(`Local pickup completed for trade ${tradeId}: ${result.fromState} → ${result.newState}`);
      return saved;
    });
  }

  private async handlePaymentSucceeded(
    tradeId: string,
    userId: string,
    type?: string,
    allUserPaymentsComplete?: boolean,
  ): Promise<void> {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) return;

    // Use column-specific UPDATE to prevent lost updates when both payments arrive concurrently
    const isPartyA = userId === trade.partyAId;
    const isPartyB = userId === trade.partyBId;
    if (!isPartyA && !isPartyB) {
      this.logger.warn(`Unknown userId ${userId} for trade ${tradeId}`);
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      const updateFields: Record<string, boolean> = {};

      // If this is an insurance payment, mark the party as insured
      if (type === 'trade_insurance') {
        if (isPartyA) updateFields.partyAInsured = true;
        if (isPartyB) updateFields.partyBInsured = true;
      }

      // Only mark party as paid when ALL their payments are complete
      // (backwards compatible: if allUserPaymentsComplete is undefined, treat as true)
      const allComplete = allUserPaymentsComplete !== false;
      if (allComplete) {
        if (isPartyA) updateFields.partyAPaid = true;
        if (isPartyB) updateFields.partyBPaid = true;
      }

      if (Object.keys(updateFields).length > 0) {
        await manager.getRepository(TradeEntity).update({ id: tradeId }, updateFields);
      }

      await manager.save(TradeEventEntity, {
        tradeId,
        eventType: type === 'trade_insurance' ? 'trade.insurance_payment_received' : 'trade.payment_received',
        fromState: trade.state,
        toState: trade.state,
        payload: { userId, party: isPartyA ? 'A' : 'B', type, allUserPaymentsComplete: allComplete },
        triggeredBy: userId,
      });
    });

    // Re-read trade with updated payment flags
    const updated = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!updated) return;

    this.logger.log(`Payment recorded for trade ${tradeId}: A=${updated.partyAPaid}, B=${updated.partyBPaid}`);

    // Check if all prerequisites are met to advance shipping
    if (
      updated.state === TradeState.VERIFIED &&
      updated.partyAPaid &&
      updated.partyBPaid &&
      updated.shippingMethod === 'shipping'
    ) {
      if (updated.riskLevel === RiskLevel.HIGH) {
        // HIGH risk: center flow — need addresses + centers
        if (updated.partyAAddressSubmitted && updated.partyBAddressSubmitted && updated.centerAId && updated.centerBId) {
          await this.handleShippingReady(tradeId);
        }
      } else {
        // LOW/MEDIUM risk: direct shipping — need addresses only
        if (updated.partyAAddressSubmitted && updated.partyBAddressSubmitted) {
          await this.handleDirectShippingReady(tradeId);
        }
      }
    }

    // Check if local pickup trade is ready to complete (both confirmed + both paid)
    if (
      updated.state === TradeState.VERIFIED &&
      updated.partyAPaid &&
      updated.partyBPaid &&
      updated.shippingMethod === 'local_pickup' &&
      updated.partyALocalPickupConfirmed &&
      updated.partyBLocalPickupConfirmed
    ) {
      await this.completeLocalPickup(tradeId, userId);
    }
  }

  private async handleShippingReady(tradeId: string): Promise<void> {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade || trade.state !== TradeState.VERIFIED) return;

    const result = this.stateMachine.transition(trade, 'shipping_ready', 'system');
    if (!result.success) return;

    await this.dataSource.transaction(async (manager) => {
      trade.state = result.newState!;
      await manager.save(trade);
      await manager.save(TradeEventEntity, {
        tradeId,
        eventType: 'trade.awaiting_shipment',
        fromState: result.fromState,
        toState: result.newState,
        payload: {},
      });

      // Create CenterVerification records for both items so admins can track them
      if (trade.centerAId) {
        await manager.save(CenterVerificationEntity, manager.create(CenterVerificationEntity, {
          tradeId: trade.id,
          listingId: trade.listingAId,
          centerId: trade.centerAId,
          party: 'A',
          status: 'pending',
        }));
        this.logger.log(`Created CenterVerification for trade ${tradeId}, party A, center ${trade.centerAId}`);
      }
      if (trade.centerBId) {
        await manager.save(CenterVerificationEntity, manager.create(CenterVerificationEntity, {
          tradeId: trade.id,
          listingId: trade.listingBId,
          centerId: trade.centerBId,
          party: 'B',
          status: 'pending',
        }));
        this.logger.log(`Created CenterVerification for trade ${tradeId}, party B, center ${trade.centerBId}`);
      }
    });
  }

  // --- Direct shipping handlers (LOW/MEDIUM risk) ---

  private async handleDirectShippingReady(tradeId: string): Promise<void> {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade || trade.state !== TradeState.VERIFIED) return;

    const result = this.stateMachine.transition(trade, 'direct_shipping_ready', 'system');
    if (!result.success) return;

    await this.dataSource.transaction(async (manager) => {
      trade.state = result.newState!;
      await manager.save(trade);
      await manager.save(TradeEventEntity, {
        tradeId,
        eventType: 'trade.direct_shipping',
        fromState: result.fromState,
        toState: result.newState,
        payload: {},
      });
    });
    this.logger.log(`Trade ${tradeId} → IN_TRANSIT (direct shipping)`);
  }

  private async handleDirectShipmentDelivered(tradeId: string): Promise<void> {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) return;

    // Handle race condition: delivered event may arrive before in_transit is committed
    if (trade.state === TradeState.VERIFIED || trade.state === TradeState.AWAITING_SHIPMENT) {
      const transitResult = this.stateMachine.transition(trade, 'direct_shipping_ready', 'system');
      if (transitResult.success) {
        trade.state = transitResult.newState!;
        this.logger.log(`Trade ${tradeId}: fast-forward ${transitResult.fromState} → IN_TRANSIT`);
      }
    }

    if (trade.state !== TradeState.IN_TRANSIT) return;

    const result = this.stateMachine.transition(trade, 'all_shipments_delivered', 'system');
    if (!result.success) return;

    await this.dataSource.transaction(async (manager) => {
      trade.state = result.newState!;
      trade.disputeWindowEnd = this.timeWindow.calculateDisputeWindowEnd(trade.riskLevel);
      trade.timeoutAt = trade.disputeWindowEnd;
      await manager.save(trade);
      await manager.save(TradeEventEntity, {
        tradeId,
        eventType: 'trade.delivered',
        fromState: result.fromState,
        toState: result.newState,
        payload: { disputeWindowEnd: trade.disputeWindowEnd?.toISOString() },
      });
    });
    this.logger.log(`Trade ${tradeId} → DELIVERED (direct shipping)`);
  }

  // --- Dispute ship-to-center handler ---

  private async handleDisputeShipToCenter(tradeId: string, centerId: string): Promise<void> {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) return;

    const center = await this.centerRepo.findOne({ where: { id: centerId, isActive: true } });
    if (!center) {
      this.logger.warn(`Center ${centerId} not found or inactive for dispute ship-to-center`);
      return;
    }

    const result = this.stateMachine.transition(trade, 'dispute_ship_to_center', 'system');
    if (!result.success) {
      this.logger.warn(`Cannot transition trade ${tradeId} for dispute ship-to-center: ${result.reason}`);
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      trade.state = result.newState!;
      trade.centerAId = centerId;
      trade.centerBId = centerId;
      trade.itemAAtCenter = false;
      trade.itemBAtCenter = false;
      trade.itemACenterVerified = false;
      trade.itemBCenterVerified = false;
      await manager.save(trade);

      await manager.save(TradeEventEntity, {
        tradeId,
        eventType: 'trade.dispute_ship_to_center',
        fromState: result.fromState,
        toState: result.newState,
        payload: { centerId, centerName: center.name },
      });

      // Create center verification records for both items
      await manager.save(CenterVerificationEntity, manager.create(CenterVerificationEntity, {
        tradeId: trade.id,
        listingId: trade.listingAId,
        centerId,
        party: 'A',
        status: 'pending',
      }));
      await manager.save(CenterVerificationEntity, manager.create(CenterVerificationEntity, {
        tradeId: trade.id,
        listingId: trade.listingBId,
        centerId,
        party: 'B',
        status: 'pending',
      }));
    });

    this.logger.log(`Trade ${tradeId} → SHIPPING_TO_CENTER (dispute inspection at ${center.name})`);
  }

  // --- Center verification handlers ---

  private async handleItemAtCenter(tradeId: string, party: string): Promise<void> {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) return;

    if (party === 'A') {
      trade.itemAAtCenter = true;
    } else {
      trade.itemBAtCenter = true;
    }

    await this.tradeRepo.save(trade);
    this.logger.log(`Trade ${tradeId}: item ${party} arrived at center (A=${trade.itemAAtCenter}, B=${trade.itemBAtCenter})`);

    // When both items are at their centers, transition to AT_CENTER
    if (trade.itemAAtCenter && trade.itemBAtCenter) {
      const result = this.stateMachine.transition(trade, 'both_items_at_center', 'system');
      if (result.success) {
        await this.dataSource.transaction(async (manager) => {
          trade.state = result.newState!;
          await manager.save(trade);
          await manager.save(TradeEventEntity, {
            tradeId,
            eventType: 'trade.at_center',
            fromState: result.fromState,
            toState: result.newState,
            payload: {},
          });
        });

        // Auto-transition to CENTER_VERIFICATION
        const inspResult = this.stateMachine.transition(trade, 'center_inspection_started', 'system');
        if (inspResult.success) {
          await this.dataSource.transaction(async (manager) => {
            trade.state = inspResult.newState!;
            await manager.save(trade);
            await manager.save(TradeEventEntity, {
              tradeId,
              eventType: 'trade.center_inspection_started',
              fromState: inspResult.fromState,
              toState: inspResult.newState,
              payload: {},
            });
          });
        }

        this.logger.log(`Trade ${tradeId} → CENTER_VERIFICATION`);
      }
    }
  }

  private async handleCenterVerificationApproved(tradeId: string, party: string): Promise<void> {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) return;

    if (party === 'A') {
      trade.itemACenterVerified = true;
    } else {
      trade.itemBCenterVerified = true;
    }

    await this.tradeRepo.save(trade);
    this.logger.log(`Trade ${tradeId}: item ${party} verified at center (A=${trade.itemACenterVerified}, B=${trade.itemBCenterVerified})`);

    // When both verified, transition to CENTER_VERIFIED
    if (trade.itemACenterVerified && trade.itemBCenterVerified) {
      const result = this.stateMachine.transition(trade, 'both_items_center_verified', 'system');
      if (result.success) {
        await this.dataSource.transaction(async (manager) => {
          trade.state = result.newState!;
          await manager.save(trade);
          await manager.save(TradeEventEntity, {
            tradeId,
            eventType: 'trade.center_verified',
            fromState: result.fromState,
            toState: result.newState,
            payload: {},
          });
        });

        // Publish center.both_verified so shipping service creates Leg 2 shipments
        await this.rabbitMQService.publish(ROUTING_KEYS.CENTER.BOTH_VERIFIED, {
          eventId: uuidv4(),
          timestamp: new Date().toISOString(),
          tradeId: trade.id,
          partyAId: trade.partyAId,
          partyBId: trade.partyBId,
          listingAId: trade.listingAId,
          listingBId: trade.listingBId,
          centerAId: trade.centerAId,
          centerBId: trade.centerBId,
          partyAAddress: trade.partyAAddress,
          partyBAddress: trade.partyBAddress,
        });

        this.logger.log(`Trade ${tradeId} → CENTER_VERIFIED, Leg 2 shipments requested`);
      }
    }
  }

  private async handleCenterVerificationRejected(tradeId: string, party: string, reason: string): Promise<void> {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) return;

    const result = this.stateMachine.transition(trade, 'center_verification_rejected', 'system');
    if (!result.success) return;

    await this.dataSource.transaction(async (manager) => {
      trade.state = result.newState!;
      trade.cancelledAt = new Date();
      await manager.save(trade);
      await manager.save(TradeEventEntity, {
        tradeId,
        eventType: 'trade.center_verification_rejected',
        fromState: result.fromState,
        toState: result.newState,
        payload: { party, reason },
      });

      await this.outboxService.addToOutbox(manager, 'trade', tradeId, ROUTING_KEYS.TRADE.CANCELLED, {
        tradeId,
        cancelledBy: 'center_verification',
        reason: `Item ${party} rejected at center: ${reason}`,
        partyAId: trade.partyAId,
        partyBId: trade.partyBId,
        listingAId: trade.listingAId,
        listingBId: trade.listingBId,
      });
    });

    // Publish center rejection event so shipping-service creates return shipments
    await this.rabbitMQService.publish(ROUTING_KEYS.CENTER.VERIFICATION_REJECTED, {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      tradeId,
      rejectedParty: party,
      reason,
      partyAId: trade.partyAId,
      partyBId: trade.partyBId,
      listingAId: trade.listingAId,
      listingBId: trade.listingBId,
      centerAId: trade.centerAId,
      centerBId: trade.centerBId,
    });

    this.logger.log(`Trade ${tradeId} → CANCELLED (center rejection: ${reason})`);
  }

  private async handleBothCenterVerified(tradeId: string): Promise<void> {
    // This is triggered by the center.both_verified event — trade-service publishes it
    // and shipping-service handles it to create Leg 2 shipments.
    // No additional trade-service action needed here.
    this.logger.log(`Both center verified event processed for trade ${tradeId}`);
  }

  private async handleLeg2InTransit(tradeId: string): Promise<void> {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade || trade.state !== TradeState.CENTER_VERIFIED) return;

    const result = this.stateMachine.transition(trade, 'all_shipments_in_transit', 'system');
    if (!result.success) return;

    await this.dataSource.transaction(async (manager) => {
      trade.state = result.newState!;
      await manager.save(trade);
      await manager.save(TradeEventEntity, {
        tradeId,
        eventType: 'trade.shipping_to_recipients',
        fromState: result.fromState,
        toState: result.newState,
        payload: {},
      });
    });
    this.logger.log(`Trade ${tradeId} → SHIPPING_TO_RECIPIENTS`);
  }

  private async handleLeg2Delivered(tradeId: string): Promise<void> {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) return;

    // Handle race condition: if delivered event arrives before in_transit is committed,
    // step through both transitions (CENTER_VERIFIED → SHIPPING_TO_RECIPIENTS → DELIVERED)
    if (trade.state === TradeState.CENTER_VERIFIED) {
      const transitResult = this.stateMachine.transition(trade, 'all_shipments_in_transit', 'system');
      if (!transitResult.success) return;
      trade.state = transitResult.newState!;
      this.logger.log(`Trade ${tradeId}: fast-forward CENTER_VERIFIED → SHIPPING_TO_RECIPIENTS`);
    }

    if (trade.state !== TradeState.SHIPPING_TO_RECIPIENTS) return;

    const result = this.stateMachine.transition(trade, 'all_shipments_delivered', 'system');
    if (!result.success) return;

    await this.dataSource.transaction(async (manager) => {
      trade.state = result.newState!;
      trade.disputeWindowEnd = this.timeWindow.calculateDisputeWindowEnd(trade.riskLevel);
      trade.timeoutAt = trade.disputeWindowEnd;
      await manager.save(trade);
      await manager.save(TradeEventEntity, {
        tradeId,
        eventType: 'trade.delivered',
        fromState: TradeState.CENTER_VERIFIED,
        toState: result.newState,
        payload: { disputeWindowEnd: trade.disputeWindowEnd?.toISOString() },
      });
    });
    this.logger.log(`Trade ${tradeId} → DELIVERED`);
  }

  async findAll(filters?: { state?: TradeState; riskLevel?: RiskLevel }): Promise<TradeEntity[]> {
    const where: Record<string, unknown> = {};
    if (filters?.state) where.state = filters.state;
    if (filters?.riskLevel) where.riskLevel = filters.riskLevel;
    return this.tradeRepo.find({
      where: Object.keys(where).length ? where : undefined,
      order: { createdAt: 'DESC' },
    });
  }

  async findByUser(userId: string): Promise<TradeEntity[]> {
    return this.tradeRepo.find({
      where: [{ partyAId: userId }, { partyBId: userId }],
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(tradeId: string): Promise<TradeEntity> {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) throw new NotFoundException('Trade not found');
    return trade;
  }

  async findOneForUser(tradeId: string, userId: string): Promise<TradeEntity> {
    const trade = await this.tradeRepo.findOne({ where: { id: tradeId } });
    if (!trade) throw new NotFoundException('Trade not found');
    if (trade.partyAId !== userId && trade.partyBId !== userId) {
      throw new ForbiddenException('Not a party to this trade');
    }
    return trade;
  }

  async getTradeEvents(tradeId: string): Promise<TradeEventEntity[]> {
    return this.eventRepo.find({ where: { tradeId }, order: { createdAt: 'ASC' } });
  }

  async cancelTrade(tradeId: string, userId: string): Promise<TradeEntity> {
    const trade = userId === 'system'
      ? await this.tradeRepo.findOne({ where: { id: tradeId } }).then(t => { if (!t) throw new NotFoundException('Trade not found'); return t; })
      : await this.findOneForUser(tradeId, userId);

    const result = this.stateMachine.transition(trade, 'cancel', userId);
    if (!result.success) throw new ForbiddenException(result.reason);

    return this.dataSource.transaction(async (manager) => {
      trade.state = result.newState!;
      trade.cancelledAt = new Date();
      const saved = await manager.save(trade);

      // Release escrow locks (Redis key + DB audit trail)
      if (trade.listingAId) {
        await this.lockService.releaseLock(manager, tradeId, trade.listingAId);
      }
      if (trade.listingBId) {
        await this.lockService.releaseLock(manager, tradeId, trade.listingBId);
      }

      await manager.save(TradeEventEntity, {
        tradeId, eventType: 'trade.cancelled',
        fromState: result.fromState, toState: result.newState,
        payload: { cancelledBy: userId },
        triggeredBy: userId === 'system' ? undefined : userId,
      });

      await this.outboxService.addToOutbox(manager, 'trade', tradeId, ROUTING_KEYS.TRADE.CANCELLED, {
        tradeId, cancelledBy: userId, reason: userId === 'system' ? 'timeout' : 'user_cancelled',
        partyAId: trade.partyAId, partyBId: trade.partyBId,
        listingAId: trade.listingAId, listingBId: trade.listingBId,
      });

      return saved;
    });
  }

  // Used by timeout scheduler
  async findTimedOutTrades(): Promise<TradeEntity[]> {
    return this.tradeRepo
      .createQueryBuilder('t')
      .where('t.timeout_at < NOW()')
      .andWhere('t.state NOT IN (:...terminalStates)', {
        terminalStates: [TradeState.COMPLETED, TradeState.CANCELLED, TradeState.REVOKED],
      })
      .getMany();
  }
}
