import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListingEntity } from './listing.entity';
import { ListingImageEntity } from './listing-image.entity';
import { ListingQuestionEntity } from './listing-question.entity';
import { ListingFavoriteEntity } from './listing-favorite.entity';
import { ListingStatus, ItemCondition, ROUTING_KEYS, QUEUES } from '@exchange/shared-types';
import { ConfigService } from '@nestjs/config';
import { RabbitMQService } from '@exchange/common';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ListingsService {
  private readonly logger = new Logger(ListingsService.name);

  constructor(
    @InjectRepository(ListingEntity)
    private readonly listingRepo: Repository<ListingEntity>,
    @InjectRepository(ListingImageEntity)
    private readonly imageRepo: Repository<ListingImageEntity>,
    @InjectRepository(ListingQuestionEntity)
    private readonly questionRepo: Repository<ListingQuestionEntity>,
    @InjectRepository(ListingFavoriteEntity)
    private readonly favoriteRepo: Repository<ListingFavoriteEntity>,
    private readonly rabbitMQService: RabbitMQService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.rabbitMQService.subscribe(
      QUEUES.LISTING_ON_TRADE,
      [ROUTING_KEYS.TRADE.LOCKED, ROUTING_KEYS.TRADE.CANCELLED, ROUTING_KEYS.TRADE.COMPLETED],
      async (msg, routingKey) => {
        if (routingKey === ROUTING_KEYS.TRADE.LOCKED) {
          await this.lockListing((msg as any).listingAId, (msg as any).tradeId);
          await this.lockListing((msg as any).listingBId, (msg as any).tradeId);
        } else if (routingKey === ROUTING_KEYS.TRADE.CANCELLED) {
          await this.unlockListing((msg as any).listingAId);
          await this.unlockListing((msg as any).listingBId);
        } else if (routingKey === ROUTING_KEYS.TRADE.COMPLETED) {
          await this.markTraded((msg as any).listingAId);
          await this.markTraded((msg as any).listingBId);
        }
      },
    );

    // Listen for boost payment succeeded events
    await this.rabbitMQService.subscribe(
      QUEUES.LISTING_ON_PAYMENT,
      [ROUTING_KEYS.PAYMENT.BOOST_SUCCEEDED],
      async (msg: Record<string, unknown>) => {
        const metadata = msg.metadata as { listingId: string; tier: string; durationDays: number };
        if (!metadata?.listingId) return;
        this.logger.log(`Boost payment succeeded for listing ${metadata.listingId}, tier=${metadata.tier}`);
        try {
          await this.activateBoost(
            metadata.listingId,
            metadata.tier as 'featured' | 'spotlight',
            metadata.durationDays,
          );
        } catch (err) {
          this.logger.error(`Failed to activate boost for listing ${metadata.listingId}: ${err}`);
        }
      },
    );
  }

  async create(
    userId: string,
    body: {
      title: string;
      description?: string;
      declaredValue?: number;
      currency?: string;
      categoryId: string;
      condition: ItemCondition;
      imageUrls?: string[];
      location?: string;
      shippingOption?: 'local_pickup' | 'shipping' | 'both';
      priceFlexibility?: 'fixed' | 'negotiable' | 'offers_only';
      hasOriginalPackaging?: boolean;
      hasPurchaseReceipt?: boolean;
      hasCertificateOfAuthenticity?: boolean;
      minExchangeValue?: number;
      maxExchangeValue?: number;
      preferredCategories?: string[];
    },
  ): Promise<ListingEntity> {
    const { imageUrls = [], ...fields } = body;
    const listing = await this.listingRepo.save({
      userId,
      ...fields,
      status: ListingStatus.ACTIVE,
    });

    if (imageUrls.length > 0) {
      const images = imageUrls.map((url, i) => ({
        listingId: listing.id,
        url,
        sortOrder: i,
      }));
      await this.imageRepo.save(images);
    }

    await this.rabbitMQService.publish(ROUTING_KEYS.LISTING.CREATED, {
      eventId: uuidv4(),
      correlationId: uuidv4(),
      idempotencyKey: `listing:${listing.id}`,
      listingId: listing.id,
      userId,
      categoryId: body.categoryId,
      declaredValue: body.declaredValue,
      title: body.title,
    });

    return this.findById(listing.id);
  }

  async findAll(page = 1, limit = 20): Promise<{ items: ListingEntity[]; total: number }> {
    const [items, total] = await this.listingRepo.findAndCount({
      where: { status: ListingStatus.ACTIVE },
      relations: ['images', 'category'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Sort featured listings first within the page
    const now = new Date();
    items.sort((a, b) => {
      const aFeatured = a.featuredUntil && new Date(a.featuredUntil) > now ? 1 : 0;
      const bFeatured = b.featuredUntil && new Date(b.featuredUntil) > now ? 1 : 0;
      return bFeatured - aFeatured;
    });

    return { items, total };
  }

  async findById(id: string): Promise<ListingEntity> {
    const listing = await this.listingRepo.findOne({
      where: { id },
      relations: ['images', 'category'],
    });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  async findByUser(userId: string): Promise<ListingEntity[]> {
    return this.listingRepo.find({
      where: { userId },
      relations: ['images', 'category'],
      order: { createdAt: 'DESC' },
    });
  }

  async findByCategory(categoryId: string): Promise<ListingEntity[]> {
    return this.listingRepo.find({
      where: { categoryId, status: ListingStatus.ACTIVE },
      relations: ['images'],
      order: { createdAt: 'DESC' },
    });
  }

  async findSpotlightListings(limit = 8): Promise<ListingEntity[]> {
    return this.listingRepo.createQueryBuilder('listing')
      .leftJoinAndSelect('listing.images', 'images')
      .leftJoinAndSelect('listing.category', 'category')
      .where('listing.status = :status', { status: ListingStatus.ACTIVE })
      .andWhere('listing.isSpotlight = true')
      .andWhere('listing.featuredUntil > NOW()')
      .orderBy('listing.featuredUntil', 'DESC')
      .take(limit)
      .getMany();
  }

  async activateBoost(listingId: string, tier: 'featured' | 'spotlight', durationDays: number): Promise<void> {
    const listing = await this.findById(listingId);
    listing.isFeatured = true;
    listing.isSpotlight = tier === 'spotlight';
    listing.featuredUntil = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    await this.listingRepo.save(listing);
    this.logger.log(`Listing ${listingId} boosted: tier=${tier}, until=${listing.featuredUntil.toISOString()}`);
  }

  async update(id: string, userId: string, updates: Partial<ListingEntity>): Promise<ListingEntity> {
    const listing = await this.findById(id);
    if (listing.userId !== userId) throw new ForbiddenException('Not your listing');
    if (listing.status !== ListingStatus.ACTIVE) throw new ForbiddenException('Cannot update a non-active listing');
    Object.assign(listing, updates);
    return this.listingRepo.save(listing);
  }

  async archive(id: string, userId: string): Promise<void> {
    const listing = await this.findById(id);
    if (listing.userId !== userId) throw new ForbiddenException('Not your listing');
    listing.status = ListingStatus.ARCHIVED;
    await this.listingRepo.save(listing);
  }

  // Q&A
  async getQuestions(listingId: string): Promise<ListingQuestionEntity[]> {
    return this.questionRepo.find({
      where: { listingId },
      order: { createdAt: 'ASC' },
    });
  }

  async askQuestion(listingId: string, askerId: string, question: string): Promise<ListingQuestionEntity> {
    await this.findById(listingId); // verify exists
    return this.questionRepo.save({ listingId, askerId, question });
  }

  async answerQuestion(listingId: string, questionId: string, userId: string, answer: string): Promise<ListingQuestionEntity> {
    const listing = await this.findById(listingId);
    if (listing.userId !== userId) throw new ForbiddenException('Only the listing owner can answer');
    const question = await this.questionRepo.findOne({ where: { id: questionId, listingId } });
    if (!question) throw new NotFoundException('Question not found');
    question.answer = answer;
    question.answeredAt = new Date();
    return this.questionRepo.save(question);
  }

  // Favorites
  async toggleFavorite(listingId: string, userId: string): Promise<{ favorited: boolean }> {
    const existing = await this.favoriteRepo.findOne({ where: { listingId, userId } });
    if (existing) {
      await this.favoriteRepo.remove(existing);
      return { favorited: false };
    }
    await this.favoriteRepo.save({ listingId, userId });
    return { favorited: true };
  }

  async getFavoritesCount(listingId: string): Promise<{ count: number }> {
    const count = await this.favoriteRepo.count({ where: { listingId } });
    return { count };
  }

  async checkFavorite(listingId: string, userId: string): Promise<{ favorited: boolean }> {
    const exists = await this.favoriteRepo.findOne({ where: { listingId, userId } });
    return { favorited: !!exists };
  }

  async getMyFavorites(userId: string): Promise<ListingEntity[]> {
    const favorites = await this.favoriteRepo.find({ where: { userId } });
    if (favorites.length === 0) return [];
    const ids = favorites.map((f) => f.listingId);
    return this.listingRepo.find({ where: ids.map((id) => ({ id })), relations: ['images', 'category'] });
  }

  private async lockListing(listingId: string, tradeId: string): Promise<void> {
    await this.listingRepo.update(listingId, { status: ListingStatus.LOCKED });
    this.logger.log(`Listing ${listingId} locked for trade ${tradeId}`);
  }

  private async unlockListing(listingId: string): Promise<void> {
    await this.listingRepo.update(listingId, { status: ListingStatus.ACTIVE });
    this.logger.log(`Listing ${listingId} unlocked`);
  }

  private async markTraded(listingId: string): Promise<void> {
    await this.listingRepo.update(listingId, { status: ListingStatus.TRADED });
    this.logger.log(`Listing ${listingId} marked as traded`);
  }
}
