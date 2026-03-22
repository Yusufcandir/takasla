import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from '../payments/payment.entity';
import { UserCleanupListener } from './user-cleanup.listener';

@Module({
  imports: [TypeOrmModule.forFeature([PaymentEntity])],
  providers: [UserCleanupListener],
})
export class CleanupModule {}
