import { DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SightEngineService } from './sightengine.service';

@Module({})
export class SightEngineModule {
  static forRoot(): DynamicModule {
    return {
      module: SightEngineModule,
      imports: [ConfigModule],
      providers: [SightEngineService],
      exports: [SightEngineService],
      global: true,
    };
  }
}
