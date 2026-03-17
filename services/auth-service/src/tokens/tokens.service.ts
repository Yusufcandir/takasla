import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { RefreshTokenEntity } from './refresh-token.entity';
import * as jwt from 'jsonwebtoken';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { JwtPayload } from '@exchange/shared-types';

@Injectable()
export class TokensService {
  constructor(
    @InjectRepository(RefreshTokenEntity)
    private readonly tokenRepo: Repository<RefreshTokenEntity>,
    private readonly config: ConfigService,
  ) {}

  generateAccessToken(userId: string, email: string, role: string): string {
    const secret = this.config.get<string>('JWT_SECRET', 'default-secret');
    const expiresIn = this.config.get<string>('JWT_EXPIRATION', '15m');
    const payload: JwtPayload = { sub: userId, email, role };
    return jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);
  }

  async generateRefreshToken(userId: string): Promise<string> {
    const rawToken = uuidv4();
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.tokenRepo.save({ userId, tokenHash, expiresAt });
    return rawToken;
  }

  async validateRefreshToken(userId: string, rawToken: string): Promise<boolean> {
    const tokens = await this.tokenRepo.find({
      where: { userId, revoked: false },
      order: { createdAt: 'DESC' },
      take: 5,
    });

    for (const token of tokens) {
      if (token.expiresAt < new Date()) continue;
      const valid = await bcrypt.compare(rawToken, token.tokenHash);
      if (valid) return true;
    }
    return false;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.tokenRepo.update({ userId, revoked: false }, { revoked: true });
  }
}
