import { Injectable, Logger, NotFoundException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerificationCenterEntity } from './verification-center.entity';
import { CenterVerificationEntity } from './center-verification.entity';
import { RabbitMQService, StorageService } from '@exchange/common';
import { ROUTING_KEYS } from '@exchange/shared-types';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CentersService implements OnModuleInit {
  private readonly logger = new Logger(CentersService.name);

  constructor(
    @InjectRepository(VerificationCenterEntity)
    private readonly centerRepo: Repository<VerificationCenterEntity>,
    @InjectRepository(CenterVerificationEntity)
    private readonly verificationRepo: Repository<CenterVerificationEntity>,
    private readonly rabbitMQService: RabbitMQService,
    private readonly storageService: StorageService,
  ) {}

  async onModuleInit() {
    await this.seedDefaultCenters();
  }

  // --- Centers CRUD ---

  async findAllCenters(activeOnly = true): Promise<VerificationCenterEntity[]> {
    const where = activeOnly ? { isActive: true } : {};
    return this.centerRepo.find({ where, order: { city: 'ASC', name: 'ASC' } });
  }

  async findCenterById(id: string): Promise<VerificationCenterEntity> {
    const center = await this.centerRepo.findOne({ where: { id } });
    if (!center) throw new NotFoundException('Verification center not found');
    return center;
  }

  async createCenter(data: Partial<VerificationCenterEntity>): Promise<VerificationCenterEntity> {
    const center = this.centerRepo.create(data);
    return this.centerRepo.save(center);
  }

  async updateCenter(id: string, data: Partial<VerificationCenterEntity>): Promise<VerificationCenterEntity> {
    const center = await this.findCenterById(id);
    Object.assign(center, data);
    return this.centerRepo.save(center);
  }

  async deactivateCenter(id: string): Promise<VerificationCenterEntity> {
    const center = await this.findCenterById(id);
    center.isActive = false;
    return this.centerRepo.save(center);
  }

  // --- Center Verifications ---

  async findPendingVerifications(centerId?: string): Promise<CenterVerificationEntity[]> {
    const qb = this.verificationRepo.createQueryBuilder('cv')
      .where('cv.status IN (:...statuses)', { statuses: ['pending', 'item_received', 'inspecting'] })
      .orderBy('cv.created_at', 'ASC');
    if (centerId) {
      qb.andWhere('cv.center_id = :centerId', { centerId });
    }
    return qb.getMany();
  }

  async findAllVerifications(tradeId?: string): Promise<CenterVerificationEntity[]> {
    const where: Record<string, unknown> = {};
    if (tradeId) where.tradeId = tradeId;
    return this.verificationRepo.find({ where, order: { createdAt: 'ASC' } });
  }

  async findVerificationById(id: string): Promise<CenterVerificationEntity> {
    const v = await this.verificationRepo.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Center verification not found');
    return v;
  }

  async createVerification(data: {
    tradeId: string;
    listingId: string;
    centerId: string;
    party: string;
  }): Promise<CenterVerificationEntity> {
    const verification = this.verificationRepo.create({
      tradeId: data.tradeId,
      listingId: data.listingId,
      centerId: data.centerId,
      party: data.party,
      status: 'pending',
    });
    return this.verificationRepo.save(verification);
  }

  async markItemReceived(verificationId: string, adminId: string): Promise<CenterVerificationEntity> {
    const v = await this.findVerificationById(verificationId);
    if (v.status !== 'pending') {
      throw new ForbiddenException('Item can only be marked received when status is pending');
    }
    v.status = 'item_received';
    v.receivedAt = new Date();
    const saved = await this.verificationRepo.save(v);

    // Publish item received event
    await this.rabbitMQService.publish(ROUTING_KEYS.CENTER.ITEM_RECEIVED, {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      tradeId: v.tradeId,
      party: v.party,
      centerId: v.centerId,
      verificationId: v.id,
    });

    this.logger.log(`Item received at center for trade ${v.tradeId}, party ${v.party}`);
    return saved;
  }

  async approveVerification(
    verificationId: string,
    adminId: string,
    notes?: string,
    photoUrls?: string[],
  ): Promise<CenterVerificationEntity> {
    const v = await this.findVerificationById(verificationId);
    if (v.status !== 'item_received' && v.status !== 'inspecting') {
      throw new ForbiddenException('Item must be received before it can be verified');
    }
    v.status = 'approved';
    v.verifiedBy = adminId;
    v.verifiedAt = new Date();
    v.notes = notes || undefined;
    if (photoUrls && photoUrls.length > 0) {
      v.photoUrls = photoUrls;
    }
    const saved = await this.verificationRepo.save(v);

    // Publish verification approved
    await this.rabbitMQService.publish(ROUTING_KEYS.CENTER.VERIFICATION_APPROVED, {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      tradeId: v.tradeId,
      party: v.party,
      centerId: v.centerId,
      verificationId: v.id,
      verifiedBy: adminId,
    });

    this.logger.log(`Item approved at center for trade ${v.tradeId}, party ${v.party}`);
    return saved;
  }

  async rejectVerification(
    verificationId: string,
    adminId: string,
    reason: string,
    photoUrls?: string[],
  ): Promise<CenterVerificationEntity> {
    const v = await this.findVerificationById(verificationId);
    if (v.status !== 'item_received' && v.status !== 'inspecting') {
      throw new ForbiddenException('Item must be received before it can be rejected');
    }
    v.status = 'rejected';
    v.verifiedBy = adminId;
    v.verifiedAt = new Date();
    v.rejectionReason = reason;
    if (photoUrls && photoUrls.length > 0) {
      v.photoUrls = photoUrls;
    }
    const saved = await this.verificationRepo.save(v);

    // Publish verification rejected
    await this.rabbitMQService.publish(ROUTING_KEYS.CENTER.VERIFICATION_REJECTED, {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      tradeId: v.tradeId,
      party: v.party,
      centerId: v.centerId,
      verificationId: v.id,
      reason,
    });

    this.logger.log(`Item rejected at center for trade ${v.tradeId}, party ${v.party}: ${reason}`);
    return saved;
  }

  async uploadVerificationPhotos(files: Express.Multer.File[]): Promise<string[]> {
    const urls: string[] = [];
    for (const file of files) {
      const result = await this.storageService.upload('center-verifications', file.buffer, file.originalname, file.mimetype);
      urls.push(result.url || `/api/centers/verification-uploads/${result.key.split('/').pop()}`);
    }
    return urls;
  }

  // --- Seed ---

  private async seedDefaultCenters(): Promise<void> {
    const count = await this.centerRepo.count();
    if (count > 0) return;

    const defaultCenters: Partial<VerificationCenterEntity>[] = [
      {
        name: 'Istanbul Kadikoy Center',
        code: 'IST-KDK',
        city: 'Istanbul',
        district: 'Kadikoy',
        street: 'Caferaga Mah. Moda Cad. No:42',
        postalCode: '34710',
        country: 'TR',
        phone: '+902163451234',
        email: 'kadikoy@exchange.com',
        contactName: 'Kadikoy Center Manager',
        operatingHours: 'Mon-Sat 09:00-18:00',
      },
      {
        name: 'Istanbul Besiktas Center',
        code: 'IST-BSK',
        city: 'Istanbul',
        district: 'Besiktas',
        street: 'Sinanpasa Mah. Barbaros Blv. No:78',
        postalCode: '34353',
        country: 'TR',
        phone: '+902122271234',
        email: 'besiktas@exchange.com',
        contactName: 'Besiktas Center Manager',
        operatingHours: 'Mon-Sat 09:00-18:00',
      },
      {
        name: 'Ankara Cankaya Center',
        code: 'ANK-CNK',
        city: 'Ankara',
        district: 'Cankaya',
        street: 'Tunali Hilmi Cad. No:56',
        postalCode: '06690',
        country: 'TR',
        phone: '+903124401234',
        email: 'ankara@exchange.com',
        contactName: 'Ankara Center Manager',
        operatingHours: 'Mon-Sat 09:00-18:00',
      },
      {
        name: 'Izmir Konak Center',
        code: 'IZM-KNK',
        city: 'Izmir',
        district: 'Konak',
        street: 'Alsancak Mah. Kibris Sehitleri Cad. No:33',
        postalCode: '35220',
        country: 'TR',
        phone: '+902324631234',
        email: 'izmir@exchange.com',
        contactName: 'Izmir Center Manager',
        operatingHours: 'Mon-Sat 09:00-18:00',
      },
    ];

    for (const center of defaultCenters) {
      await this.centerRepo.save(this.centerRepo.create(center));
    }

    this.logger.log(`Seeded ${defaultCenters.length} default verification centers`);
  }
}
