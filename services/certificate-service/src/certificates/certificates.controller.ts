import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, Public } from '@exchange/common';
import { JwtPayload } from '@exchange/shared-types';
import { CertificatesService } from './certificates.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { TransferCertificateDto } from './dto';

@Controller('certificates')
@UseGuards(JwtAuthGuard)
export class CertificatesController {
  constructor(
    private readonly certificatesService: CertificatesService,
    private readonly blockchainService: BlockchainService,
  ) {}

  @Public()
  @Post('anchor')
  async triggerAnchor() {
    return this.blockchainService.buildAndAnchor();
  }

  @Get()
  async getMyCertificates(@CurrentUser() user: JwtPayload) {
    return this.certificatesService.findByOwner(user.sub);
  }

  @Get('trade/:tradeId')
  async getCertificatesByTrade(@Param('tradeId') tradeId: string) {
    return this.certificatesService.findByTradeId(tradeId);
  }

  @Get(':id/proof')
  async getMerkleProof(@Param('id') id: string) {
    return this.certificatesService.getMerkleProof(id);
  }

  @Get(':id/verify')
  async verifyCertificate(@Param('id') id: string) {
    return this.certificatesService.verifyCertificateIntegrity(id);
  }

  @Get(':id')
  async getCertificate(@Param('id') id: string) {
    return this.certificatesService.findByCertificateId(id);
  }

  @Post(':id/transfer')
  async transferOwnership(
    @Param('id') id: string,
    @Body() body: TransferCertificateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.certificatesService.transferOwnership(id, user.sub, body.toUserId);
  }

  @Post(':id/revoke')
  async revokeCertificate(@Param('id') id: string) {
    return this.certificatesService.revoke(id);
  }
}
