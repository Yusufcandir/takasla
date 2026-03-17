import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { DatabaseModule, RabbitMQModule, HealthModule, StorageModule } from '@exchange/common';
import { ProfilesModule } from './profiles/profiles.module';
import { TrustModule } from './trust/trust.module';
import { AddressesModule } from './addresses/addresses.module';
import { ProfileEntity } from './profiles/profile.entity';
import { TrustScoreEntity } from './trust/trust-score.entity';
import { AddressEntity } from './addresses/address.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule.forRoot({
      entities: [ProfileEntity, TrustScoreEntity, AddressEntity],
      migrationsDir: join(__dirname, 'migrations'),
      dbHostEnv: 'USER_DB_HOST',
      dbPortEnv: 'USER_DB_PORT',
      dbNameEnv: 'USER_DB_NAME',
      dbUserEnv: 'USER_DB_USER',
      dbPasswordEnv: 'USER_DB_PASSWORD',
    }),
    RabbitMQModule.forRoot(),
    StorageModule.forRoot(),
    HealthModule,
    ProfilesModule,
    TrustModule,
    AddressesModule,
  ],
})
export class AppModule {}
