import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { RefreshTokenEntity } from '../tokens/refresh-token.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, RefreshTokenEntity])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
