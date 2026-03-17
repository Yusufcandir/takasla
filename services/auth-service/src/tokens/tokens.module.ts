import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshTokenEntity } from './refresh-token.entity';
import { VerificationTokenEntity } from './verification-token.entity';
import { TokensService } from './tokens.service';

@Module({
  imports: [TypeOrmModule.forFeature([RefreshTokenEntity, VerificationTokenEntity])],
  providers: [TokensService],
  exports: [TokensService, TypeOrmModule],
})
export class TokensModule {}
