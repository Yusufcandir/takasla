import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { RefreshTokenEntity } from '../tokens/refresh-token.entity';
import { BannedEmailEntity } from './banned-email.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, RefreshTokenEntity, BannedEmailEntity])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
