import { Module, Global } from '@nestjs/common';
import { GeliverProvider } from './geliver.provider';
import { CarrierProviderService } from './carrier-provider.service';

@Global()
@Module({
  providers: [GeliverProvider, CarrierProviderService],
  exports: [CarrierProviderService, GeliverProvider],
})
export class CarriersModule {}
