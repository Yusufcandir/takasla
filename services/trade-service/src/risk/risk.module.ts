import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RiskAssessorService } from './risk-assessor.service';
import { ExternalDataService } from './external-data.service';

@Module({
  imports: [HttpModule],
  providers: [RiskAssessorService, ExternalDataService],
  exports: [RiskAssessorService, ExternalDataService],
})
export class RiskModule {}
