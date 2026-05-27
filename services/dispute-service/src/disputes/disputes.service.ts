import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DisputeEntity } from './dispute.entity';
import { EvidenceEntity } from './evidence.entity';
import { ModeratorActionEntity } from './moderator-action.entity';
import { DisputeStatus, DisputeReason, DisputeOutcome, CompensationAction, AppealStatus, ROUTING_KEYS, QUEUES } from '@exchange/shared-types';
import { RabbitMQService } from '@exchange/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    @InjectRepository(DisputeEntity)
    private readonly disputeRepo: Repository<DisputeEntity>,
    @InjectRepository(EvidenceEntity)
    private readonly evidenceRepo: Repository<EvidenceEntity>,
    @InjectRepository(ModeratorActionEntity)
    private readonly actionRepo: Repository<ModeratorActionEntity>,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async onModuleInit() {
    await this.rabbitMQService.subscribe(
      QUEUES.DISPUTE_ON_TRADE,
      [ROUTING_KEYS.TRADE.DISPUTE_OPENED],
      async (msg) => {
        const { tradeId, openedBy, reason, description } = msg as {
          tradeId: string;
          openedBy: string;
          reason?: string;
          description?: string;
        };
        // Check if a dispute for this trade already exists (idempotency)
        const existing = await this.disputeRepo.findOne({ where: { tradeId } });
        if (existing) return;

        await this.openDispute(
          tradeId,
          openedBy,
          (reason as DisputeReason) ?? DisputeReason.OTHER,
          description,
        );
      },
    );

  }

  async openDispute(
    tradeId: string,
    openedBy: string,
    reason: DisputeReason,
    description?: string,
  ): Promise<DisputeEntity> {
    const dispute = await this.disputeRepo.save({
      tradeId,
      openedBy,
      reason,
      description,
      status: DisputeStatus.OPEN,
      slaDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h SLA for first response
    });

    await this.rabbitMQService.publish(ROUTING_KEYS.DISPUTE.OPENED, {
      eventId: uuidv4(),
      correlationId: uuidv4(),
      idempotencyKey: `dispute:${dispute.id}`,
      disputeId: dispute.id,
      tradeId,
      openedBy,
      reason,
    });

    this.logger.log(`Dispute opened: ${dispute.id} for trade ${tradeId}`);
    return dispute;
  }

  async uploadEvidence(
    disputeId: string,
    uploadedBy: string,
    type: string,
    url?: string,
    description?: string,
    fileHash?: string,
  ): Promise<EvidenceEntity> {
    await this.findById(disputeId);
    return this.evidenceRepo.save({
      disputeId,
      uploadedBy,
      type,
      url,
      description,
      fileHash,
    });
  }

  async resolve(
    disputeId: string,
    moderatorId: string,
    resolution: string,
    outcome: 'completed' | 'revoked',
    outcomeType: DisputeOutcome,
    compensationAction: CompensationAction,
    compensationAmount?: number,
    centerId?: string,
  ): Promise<DisputeEntity> {
    const dispute = await this.findById(disputeId);

    // Ship to center: don't resolve yet — user must ship item to center for physical inspection
    if (outcomeType === DisputeOutcome.SHIP_TO_CENTER) {
      if (!centerId) {
        throw new ForbiddenException('A verification center must be selected for ship-to-center resolution');
      }

      // Generate a unique 8-char shipment code
      const shipmentCode = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();

      dispute.status = DisputeStatus.UNDER_REVIEW;
      dispute.resolution = resolution;
      dispute.resolvedBy = moderatorId;
      dispute.outcomeType = outcomeType;
      dispute.centerId = centerId;
      dispute.shipmentCode = shipmentCode;
      const saved = await this.disputeRepo.save(dispute);

      await this.actionRepo.save({
        disputeId,
        moderatorId,
        actionType: 'ship_to_center',
        notes: `Ship to center for inspection (code: ${shipmentCode}): ${resolution}`,
      });

      this.logger.log(`Dispute ${dispute.id}: awaiting shipment to center ${centerId}, code=${shipmentCode}`);
      return saved;
    }

    // Evidence requirements: must have at least one photo AND one video before resolution
    const evidence = await this.evidenceRepo.find({ where: { disputeId } });
    const hasPhoto = evidence.some(e => e.type === 'photo' || e.type === 'image');
    const hasVideo = evidence.some(e => e.type === 'video');
    if (!hasPhoto || !hasVideo) {
      throw new ForbiddenException(
        'Cannot resolve dispute without sufficient evidence. At least one photo and one video are required.',
      );
    }

    dispute.status = DisputeStatus.RESOLVED;
    dispute.resolution = resolution;
    dispute.resolvedBy = moderatorId;
    dispute.resolvedAt = new Date();
    dispute.outcomeType = outcomeType;
    dispute.compensationAction = compensationAction;
    dispute.compensationAmount = compensationAmount;
    // 72h appeal window after resolution
    dispute.appealDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const saved = await this.disputeRepo.save(dispute);

    await this.actionRepo.save({
      disputeId,
      moderatorId,
      actionType: 'resolve',
      notes: `${outcomeType} / ${compensationAction}: ${resolution}`,
    });

    await this.rabbitMQService.publish(ROUTING_KEYS.DISPUTE.RESOLVED, {
      eventId: uuidv4(),
      correlationId: uuidv4(),
      idempotencyKey: `resolve:${dispute.id}`,
      disputeId: dispute.id,
      tradeId: dispute.tradeId,
      resolution,
      resolvedBy: moderatorId,
      outcome,
      outcomeType,
      compensationAction,
      compensationAmount,
    });

    // Notify dispute opener via email
    await this.rabbitMQService.publish(ROUTING_KEYS.MODERATION.DISPUTE_RESOLVED, {
      eventId: uuidv4(),
      correlationId: uuidv4(),
      idempotencyKey: `dispute-notify:${dispute.id}`,
      disputeId: dispute.id,
      tradeId: dispute.tradeId,
      openedBy: dispute.openedBy,
      resolution,
      outcomeType,
      compensationAction,
      compensationAmount,
    });

    this.logger.log(`Dispute resolved: ${dispute.id} -> ${outcomeType}/${compensationAction}`);
    return saved;
  }

  async markCenterReceived(disputeId: string, moderatorId: string): Promise<DisputeEntity> {
    const dispute = await this.findById(disputeId);
    if (dispute.outcomeType !== DisputeOutcome.SHIP_TO_CENTER) {
      throw new ForbiddenException('This dispute is not in a ship-to-center flow');
    }
    if (dispute.centerReceivedAt) {
      throw new ForbiddenException('Item has already been marked as received');
    }
    dispute.centerReceivedAt = new Date();
    const saved = await this.disputeRepo.save(dispute);

    await this.actionRepo.save({
      disputeId,
      moderatorId,
      actionType: 'center_received',
      notes: `Item received at center (code: ${dispute.shipmentCode})`,
    });

    this.logger.log(`Dispute ${dispute.id}: item received at center`);
    return saved;
  }

  async finalizeCenterInspection(
    disputeId: string,
    moderatorId: string,
    decision: 'damaged' | 'not_damaged',
    notes?: string,
  ): Promise<DisputeEntity> {
    const dispute = await this.findById(disputeId);
    if (dispute.outcomeType !== DisputeOutcome.SHIP_TO_CENTER || !dispute.centerReceivedAt) {
      throw new ForbiddenException('Item must be received at center before making a decision');
    }
    if (dispute.status === DisputeStatus.RESOLVED) {
      throw new ForbiddenException('This dispute has already been resolved');
    }

    if (decision === 'damaged') {
      dispute.outcomeType = DisputeOutcome.BUYER_WINS;
      dispute.compensationAction = CompensationAction.FULL_REFUND;
      dispute.resolution = (dispute.resolution || '') + ' | Center confirmed item damaged — full refund.';
    } else {
      dispute.outcomeType = DisputeOutcome.SELLER_WINS;
      dispute.compensationAction = CompensationAction.NO_REFUND;
      dispute.resolution = (dispute.resolution || '') + ' | Center verified item is acceptable — trade completed.';
    }

    dispute.status = DisputeStatus.RESOLVED;
    dispute.resolvedAt = new Date();
    dispute.appealDeadline = new Date(Date.now() + 72 * 60 * 60 * 1000);
    const saved = await this.disputeRepo.save(dispute);

    await this.actionRepo.save({
      disputeId,
      moderatorId,
      actionType: 'center_decision',
      notes: `Center decision: ${decision}${notes ? ' — ' + notes : ''}`,
    });

    const outcome = decision === 'damaged' ? 'revoked' : 'completed';
    await this.rabbitMQService.publish(ROUTING_KEYS.DISPUTE.RESOLVED, {
      eventId: uuidv4(),
      correlationId: uuidv4(),
      idempotencyKey: `center-decision:${dispute.id}`,
      disputeId: dispute.id,
      tradeId: dispute.tradeId,
      resolution: dispute.resolution,
      resolvedBy: moderatorId,
      outcome,
      outcomeType: dispute.outcomeType,
      compensationAction: dispute.compensationAction,
    });

    await this.rabbitMQService.publish(ROUTING_KEYS.MODERATION.DISPUTE_RESOLVED, {
      eventId: uuidv4(),
      correlationId: uuidv4(),
      idempotencyKey: `center-notify:${dispute.id}`,
      disputeId: dispute.id,
      tradeId: dispute.tradeId,
      openedBy: dispute.openedBy,
      resolution: dispute.resolution,
      outcomeType: dispute.outcomeType,
      compensationAction: dispute.compensationAction,
    });

    this.logger.log(`Dispute ${dispute.id}: center decision=${decision} → ${dispute.outcomeType}`);
    return saved;
  }

  async appealDispute(
    disputeId: string,
    userId: string,
    reason: string,
  ): Promise<DisputeEntity> {
    const dispute = await this.findById(disputeId);

    if (dispute.status !== DisputeStatus.RESOLVED) {
      throw new ForbiddenException('Only resolved disputes can be appealed');
    }
    if (dispute.appealStatus !== AppealStatus.NONE) {
      throw new ForbiddenException('This dispute has already been appealed');
    }
    if (dispute.appealDeadline && new Date() > dispute.appealDeadline) {
      throw new ForbiddenException('Appeal deadline has passed');
    }

    dispute.appealStatus = AppealStatus.PENDING;
    dispute.appealedBy = userId;
    dispute.appealReason = reason;
    dispute.status = DisputeStatus.UNDER_REVIEW;
    const saved = await this.disputeRepo.save(dispute);

    await this.actionRepo.save({
      disputeId,
      moderatorId: userId,
      actionType: 'appeal',
      notes: `Appeal filed: ${reason}`,
    });

    this.logger.log(`Dispute appealed: ${dispute.id} by ${userId}`);
    return saved;
  }

  async addModeratorAction(disputeId: string, moderatorId: string, actionType: string, notes?: string): Promise<ModeratorActionEntity> {
    await this.findById(disputeId);
    return this.actionRepo.save({ disputeId, moderatorId, actionType, notes });
  }

  async findById(id: string): Promise<DisputeEntity> {
    const dispute = await this.disputeRepo.findOne({
      where: { id },
      relations: ['evidence'],
    });
    if (!dispute) throw new NotFoundException('Dispute not found');
    return dispute;
  }

  async countByUser(userId: string): Promise<number> {
    return this.disputeRepo.count({ where: { openedBy: userId } });
  }

  async findByTrade(tradeId: string): Promise<DisputeEntity[]> {
    return this.disputeRepo.find({ where: { tradeId }, relations: ['evidence'] });
  }

  async findOpen(): Promise<DisputeEntity[]> {
    return this.disputeRepo.find({
      where: [{ status: DisputeStatus.OPEN }, { status: DisputeStatus.UNDER_REVIEW }],
      relations: ['evidence'],
      order: { createdAt: 'ASC' },
    });
  }
}
