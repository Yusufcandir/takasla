import { Injectable, Logger } from '@nestjs/common';
import { CarrierProvider } from './carrier-provider.interface';
import { GeliverProvider } from './geliver.provider';

@Injectable()
export class CarrierProviderService {
  private readonly logger = new Logger(CarrierProviderService.name);

  constructor(private readonly geliver: GeliverProvider) {}

  getProvider(): CarrierProvider {
    this.logger.log('Routing to Geliver (Turkish domestic)');
    return this.geliver;
  }

  getProviderByName(name: string): CarrierProvider | null {
    if (name === 'geliver') return this.geliver;
    return null;
  }
}
