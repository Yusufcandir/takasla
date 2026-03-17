import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';
import { DatabaseModule, RabbitMQModule, HealthModule } from '@exchange/common';
import { CertificatesModule } from './certificates/certificates.module';
import { MerkleModule } from './merkle/merkle.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { CertificateEntity } from './certificates/certificate.entity';
import { OwnershipTransferEntity } from './certificates/ownership-transfer.entity';
import { MerkleTreeEntity } from './merkle/merkle-tree.entity';
import { BlockchainAnchorEntity } from './blockchain/anchor.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    DatabaseModule.forRoot({
      entities: [CertificateEntity, OwnershipTransferEntity, MerkleTreeEntity, BlockchainAnchorEntity],
      migrationsDir: join(__dirname, 'migrations'),
      dbHostEnv: 'CERTIFICATE_DB_HOST',
      dbPortEnv: 'CERTIFICATE_DB_PORT',
      dbNameEnv: 'CERTIFICATE_DB_NAME',
      dbUserEnv: 'CERTIFICATE_DB_USER',
      dbPasswordEnv: 'CERTIFICATE_DB_PASSWORD',
    }),
    RabbitMQModule.forRoot(),
    HealthModule,
    CertificatesModule,
    MerkleModule,
    BlockchainModule,
  ],
})
export class AppModule {}
