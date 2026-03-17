import { Module } from '@nestjs/common';
import { IyzicoService } from './iyzico.service';

@Module({
  providers: [IyzicoService],
  exports: [IyzicoService],
})
export class IyzicoModule {}
