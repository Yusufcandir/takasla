import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificateEntity } from './certificate.entity';
import { OwnershipTransferEntity } from './ownership-transfer.entity';
import { MerkleTreeEntity } from '../merkle/merkle-tree.entity';
import { BlockchainAnchorEntity } from '../blockchain/anchor.entity';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CertificateEntity, OwnershipTransferEntity, MerkleTreeEntity, BlockchainAnchorEntity]),
    forwardRef(() => BlockchainModule),
  ],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
