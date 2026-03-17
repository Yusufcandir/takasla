import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MerkleTreeEntity } from './merkle-tree.entity';
import { CertificateEntity } from '../certificates/certificate.entity';
import { MerkleService } from './merkle.service';
import { CertificatesModule } from '../certificates/certificates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MerkleTreeEntity, CertificateEntity]),
    forwardRef(() => CertificatesModule),
  ],
  providers: [MerkleService],
  exports: [MerkleService],
})
export class MerkleModule {}
