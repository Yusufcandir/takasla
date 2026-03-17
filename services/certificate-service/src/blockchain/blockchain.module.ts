import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlockchainAnchorEntity } from './anchor.entity';
import { BlockchainService } from './blockchain.service';
import { MerkleModule } from '../merkle/merkle.module';

@Module({
  imports: [TypeOrmModule.forFeature([BlockchainAnchorEntity]), MerkleModule],
  providers: [BlockchainService],
  exports: [BlockchainService],
})
export class BlockchainModule {}
