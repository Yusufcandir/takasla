import { Injectable, ConflictException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';
import { RefreshTokenEntity } from '../tokens/refresh-token.entity';
import { BannedEmailEntity } from './banned-email.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly tokenRepo: Repository<RefreshTokenEntity>,
    @InjectRepository(BannedEmailEntity)
    private readonly bannedEmailRepo: Repository<BannedEmailEntity>,
  ) {}

  async create(email: string, password: string, role: string = 'user'): Promise<UserEntity> {
    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);
    const user = this.userRepo.create({ email, passwordHash, role });
    return this.userRepo.save(user);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async validatePassword(user: UserEntity, password: string): Promise<boolean> {
    return bcrypt.compare(password, user.passwordHash);
  }

  async findAll(): Promise<Omit<UserEntity, 'passwordHash'>[]> {
    const users = await this.userRepo.find({ order: { createdAt: 'DESC' } });
    return users.map(({ passwordHash: _ph, ...rest }) => rest);
  }

  async markVerified(userId: string): Promise<void> {
    await this.userRepo.update({ id: userId }, { isVerified: true });
  }

  async deleteById(userId: string): Promise<void> {
    await this.tokenRepo.delete({ userId });
    await this.userRepo.delete({ id: userId });
  }

  async isEmailBanned(email: string): Promise<boolean> {
    const banned = await this.bannedEmailRepo.findOne({ where: { email: email.toLowerCase() } });
    return !!banned;
  }

  async banById(userId: string, bannedBy: string): Promise<void> {
    const user = await this.findById(userId);
    // Add email to banned list
    const existing = await this.bannedEmailRepo.findOne({ where: { email: user.email.toLowerCase() } });
    if (!existing) {
      await this.bannedEmailRepo.save({
        email: user.email.toLowerCase(),
        bannedBy,
      });
    }
    this.logger.log(`User ${userId} (${user.email}) banned by ${bannedBy}`);
    // Delete the user
    await this.deleteById(userId);
  }
}
