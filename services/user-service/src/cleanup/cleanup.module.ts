import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfileEntity } from '../profiles/profile.entity';
import { AddressEntity } from '../addresses/address.entity';
import { UserCleanupListener } from './user-cleanup.listener';

@Module({
  imports: [TypeOrmModule.forFeature([ProfileEntity, AddressEntity])],
  providers: [UserCleanupListener],
})
export class CleanupModule {}
