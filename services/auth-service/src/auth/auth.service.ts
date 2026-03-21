import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { TokensService } from '../tokens/tokens.service';
import { EmailService } from '../email/email.service';
import { RabbitMQService } from '@exchange/common';
import { ROUTING_KEYS } from '@exchange/shared-types';
import { VerificationTokenEntity } from '../tokens/verification-token.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tokensService: TokensService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly emailService: EmailService,
    @InjectRepository(VerificationTokenEntity)
    private readonly verificationTokenRepo: Repository<VerificationTokenEntity>,
  ) {}

  async register(email: string, password: string, displayName: string, role: string = 'user') {
    const banned = await this.usersService.isEmailBanned(email);
    if (banned) {
      throw new ForbiddenException('This email address has been banned from the platform');
    }

    const user = await this.usersService.create(email, password, role);

    await this.rabbitMQService.publish(ROUTING_KEYS.AUTH.USER_REGISTERED, {
      eventId: uuidv4(),
      correlationId: uuidv4(),
      idempotencyKey: `register:${user.id}`,
      userId: user.id,
      email: user.email,
      role: user.role,
      displayName,
    });

    // Create verification token (24h expiry)
    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    await this.verificationTokenRepo.save({ userId: user.id, token, expiresAt });

    // Send verification email (fire-and-forget to avoid blocking on SMTP issues)
    this.emailService.sendVerificationEmail(email, token).catch((err) => {
      // Logged inside EmailService, swallow here so registration still succeeds
    });

    return { message: 'Verification email sent. Please check your inbox.', userId: user.id };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await this.usersService.validatePassword(user, password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.isVerified) {
      throw new UnauthorizedException('Email not verified. Please check your inbox or resend verification.');
    }

    const accessToken = this.tokensService.generateAccessToken(user.id, user.email, user.role);
    const refreshToken = await this.tokensService.generateRefreshToken(user.id);

    return { accessToken, refreshToken, userId: user.id };
  }

  async verifyEmail(token: string) {
    const record = await this.verificationTokenRepo.findOne({ where: { token } });
    if (!record) throw new BadRequestException('Invalid verification token');
    if (record.used) throw new BadRequestException('This verification link has already been used');
    if (record.expiresAt < new Date()) throw new BadRequestException('Verification link has expired. Please request a new one.');

    record.used = true;
    await this.verificationTokenRepo.save(record);
    await this.usersService.markVerified(record.userId);

    // Auto-login after verification
    const user = await this.usersService.findById(record.userId);
    const accessToken = this.tokensService.generateAccessToken(user.id, user.email, user.role);
    const refreshToken = await this.tokensService.generateRefreshToken(user.id);

    return { accessToken, refreshToken, userId: user.id };
  }

  async resendVerification(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new BadRequestException('No account found with this email');
    if (user.isVerified) throw new BadRequestException('Email is already verified');

    const token = uuidv4();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    await this.verificationTokenRepo.save({ userId: user.id, token, expiresAt });

    this.emailService.sendVerificationEmail(email, token).catch((err) => {
      // Logged inside EmailService, swallow here so resend still returns
    });

    return { message: 'Verification email resent. Please check your inbox.' };
  }

  async refresh(userId: string, refreshToken: string) {
    const valid = await this.tokensService.validateRefreshToken(userId, refreshToken);
    if (!valid) throw new UnauthorizedException('Invalid refresh token');

    const user = await this.usersService.findById(userId);
    const accessToken = this.tokensService.generateAccessToken(user.id, user.email, user.role);
    const newRefreshToken = await this.tokensService.generateRefreshToken(user.id);

    return { accessToken, refreshToken: newRefreshToken, userId: user.id };
  }

  async banUser(userId: string, bannedBy: string): Promise<void> {
    // Get user email BEFORE deletion for the ban notification
    const user = await this.usersService.findById(userId);
    // Send ban email (fire-and-forget — don't block the ban on email delivery)
    this.emailService.sendBanNotificationEmail(user.email).catch(() => {});
    await this.usersService.banById(userId, bannedBy);
  }
}
