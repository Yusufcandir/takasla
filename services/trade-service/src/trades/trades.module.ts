import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TradeEntity } from './trade.entity';
import { TradeEventEntity } from './trade-event.entity';
import { TradeLockEntity } from './trade-lock.entity';
import { ProofPackageEntity } from './proof-package.entity';
import { TradesController } from './trades.controller';
import { TradesService } from './trades.service';
import { TradeTimeoutScheduler } from './trade-timeout.scheduler';
import { DeliveryConfirmationScheduler } from './delivery-confirmation.scheduler';
import { StateMachineModule } from '../state-machine/state-machine.module';
import { RiskModule } from '../risk/risk.module';
import { EscrowModule } from '../escrow/escrow.module';
import { OutboxModule } from '@exchange/common';
import { ExifService } from '../proofs/exif.service';
import { ImageHashService } from '../proofs/image-hash.service';
import { ProofImageHashEntity } from '../proofs/proof-image-hash.entity';
import { VerificationCenterEntity } from '../centers/verification-center.entity';
import { CenterVerificationEntity } from '../centers/center-verification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([TradeEntity, TradeEventEntity, TradeLockEntity, ProofPackageEntity, ProofImageHashEntity, VerificationCenterEntity, CenterVerificationEntity]),
    StateMachineModule,
    RiskModule,
    EscrowModule,
    OutboxModule,
  ],
  controllers: [TradesController],
  providers: [TradesService, TradeTimeoutScheduler, DeliveryConfirmationScheduler, ExifService, ImageHashService],
  exports: [TradesService],
})
export class TradesModule {}
