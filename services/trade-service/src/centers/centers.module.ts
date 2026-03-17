import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationCenterEntity } from './verification-center.entity';
import { CenterVerificationEntity } from './center-verification.entity';
import { CentersService } from './centers.service';
import { CentersController } from './centers.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([VerificationCenterEntity, CenterVerificationEntity]),
  ],
  controllers: [CentersController],
  providers: [CentersService],
  exports: [CentersService],
})
export class CentersModule {}
