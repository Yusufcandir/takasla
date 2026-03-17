import { Injectable, Logger, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OfferEntity } from './offer.entity';
import { CounterOfferEntity } from './counter-offer.entity';
import { OfferStatus, ROUTING_KEYS } from '@exchange/shared-types';
import { RabbitMQService } from '@exchange/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name);

  constructor(
    @InjectRepository(OfferEntity)
    private readonly offerRepo: Repository<OfferEntity>,
    @InjectRepository(CounterOfferEntity)
    private readonly counterRepo: Repository<CounterOfferEntity>,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async create(
    offererId: string,
    listingId: string,
    offeredListingId: string,
    listingOwnerId: string,
    message?: string,
    idempotencyKey?: string,
  ): Promise<OfferEntity> {
    if (offererId === listingOwnerId) {
      throw new BadRequestException('Cannot make an offer on your own listing');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const offer = await this.offerRepo.save({
      offererId,
      listingId,
      offeredListingId,
      listingOwnerId,
      message,
      expiresAt,
      idempotencyKey,
    });

    await this.rabbitMQService.publish(ROUTING_KEYS.OFFER.CREATED, {
      eventId: uuidv4(),
      correlationId: uuidv4(),
      idempotencyKey: idempotencyKey || `offer:${offer.id}`,
      offerId: offer.id,
      listingId,
      offeredListingId,
      offererId,
      listingOwnerId,
    });

    this.logger.log(`Offer created: ${offer.id}`);
    return offer;
  }

  async accept(offerId: string, userId: string): Promise<OfferEntity> {
    const offer = await this.findById(offerId);
    if (offer.listingOwnerId !== userId) throw new ForbiddenException('Only listing owner can accept');
    if (offer.status !== OfferStatus.PENDING) throw new BadRequestException('Offer is not pending');

    offer.status = OfferStatus.ACCEPTED;
    const saved = await this.offerRepo.save(offer);

    await this.rabbitMQService.publish(ROUTING_KEYS.OFFER.ACCEPTED, {
      eventId: uuidv4(),
      correlationId: uuidv4(),
      idempotencyKey: `accept:${offer.id}`,
      offerId: offer.id,
      listingId: offer.listingId,
      offeredListingId: offer.offeredListingId,
      partyAId: offer.listingOwnerId,
      partyBId: offer.offererId,
    });

    this.logger.log(`Offer accepted: ${offer.id}`);
    return saved;
  }

  async reject(offerId: string, userId: string): Promise<OfferEntity> {
    const offer = await this.findById(offerId);
    if (offer.listingOwnerId !== userId) throw new ForbiddenException('Only listing owner can reject');
    if (offer.status !== OfferStatus.PENDING) throw new BadRequestException('Offer is not pending');

    offer.status = OfferStatus.REJECTED;
    const saved = await this.offerRepo.save(offer);

    await this.rabbitMQService.publish(ROUTING_KEYS.OFFER.REJECTED, {
      eventId: uuidv4(),
      correlationId: uuidv4(),
      idempotencyKey: `reject:${offer.id}`,
      offerId: offer.id,
      rejectedBy: userId,
    });

    return saved;
  }

  async cancel(offerId: string, userId: string): Promise<OfferEntity> {
    const offer = await this.findById(offerId);
    if (offer.offererId !== userId) throw new ForbiddenException('Only offerer can cancel');
    if (offer.status !== OfferStatus.PENDING) throw new BadRequestException('Offer is not pending');

    offer.status = OfferStatus.CANCELLED;
    return this.offerRepo.save(offer);
  }

  async counterOffer(offerId: string, userId: string, proposedListingId: string, message?: string): Promise<CounterOfferEntity> {
    const offer = await this.findById(offerId);
    if (offer.listingOwnerId !== userId) throw new ForbiddenException('Only listing owner can counter');
    if (offer.status !== OfferStatus.PENDING) throw new BadRequestException('Offer is not pending');

    offer.status = OfferStatus.COUNTERED;
    await this.offerRepo.save(offer);

    return this.counterRepo.save({
      originalOfferId: offerId,
      proposedListingId,
      proposedBy: userId,
      message,
    });
  }

  async findById(id: string): Promise<OfferEntity> {
    const offer = await this.offerRepo.findOne({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');
    return offer;
  }

  async findByListing(listingId: string): Promise<OfferEntity[]> {
    return this.offerRepo.find({
      where: { listingId },
      order: { createdAt: 'DESC' },
    });
  }

  async findByUser(userId: string): Promise<{ sent: OfferEntity[]; received: OfferEntity[] }> {
    const [sent, received] = await Promise.all([
      this.offerRepo.find({ where: { offererId: userId }, order: { createdAt: 'DESC' } }),
      this.offerRepo.find({ where: { listingOwnerId: userId }, order: { createdAt: 'DESC' } }),
    ]);
    return { sent, received };
  }
}
