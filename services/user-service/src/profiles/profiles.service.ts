import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProfileEntity } from './profile.entity';
import { RabbitMQService } from '@exchange/common';
import { ROUTING_KEYS } from '@exchange/shared-types';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(ProfileEntity)
    private readonly profileRepo: Repository<ProfileEntity>,
    private readonly rabbitMQService: RabbitMQService,
  ) {}

  async onModuleInit() {
    await this.rabbitMQService.subscribe(
      'user-service.user-registered',
      [ROUTING_KEYS.AUTH.USER_REGISTERED],
      async (msg: any) => {
        await this.createFromRegistration(msg.userId, msg.displayName, msg.email);
      },
    );
  }

  async createFromRegistration(userId: string, displayName: string, email: string): Promise<ProfileEntity> {
    const existing = await this.profileRepo.findOne({ where: { userId } });
    if (existing) return existing;

    const profile = this.profileRepo.create({
      userId,
      displayName: displayName || email.split('@')[0],
    });
    return this.profileRepo.save(profile);
  }

  async findByUserId(userId: string): Promise<ProfileEntity> {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async update(userId: string, updates: Partial<Pick<ProfileEntity, 'displayName' | 'avatarUrl' | 'bio' | 'location'>>): Promise<ProfileEntity> {
    const profile = await this.findByUserId(userId);
    Object.assign(profile, updates);
    return this.profileRepo.save(profile);
  }

  async incrementTrades(userId: string, completed: boolean): Promise<void> {
    const profile = await this.findByUserId(userId);
    profile.totalTrades += 1;
    if (completed) profile.completedTrades += 1;
    await this.profileRepo.save(profile);
  }
}
