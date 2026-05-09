import { Controller, Get, Post, Param, Body, Query, UseGuards, HttpCode, HttpStatus, UseInterceptors, UploadedFiles, Res } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, CurrentUser, Roles, Public, StorageService, SightEngineService } from '@exchange/common';
import { JwtPayload, TradeState, RiskLevel } from '@exchange/shared-types';
import { TradesService } from './trades.service';
import { TradeStateMachine } from '../state-machine/trade-state-machine';
import { SubmitProofDto, RejectVerificationDto, OpenDisputeDto, SetShippingMethodDto, SubmitAddressDto } from './dto';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { Response } from 'express';
import { existsSync } from 'fs';
import { createHash } from 'crypto';
import { ExifService } from '../proofs/exif.service';
import { ImageHashService } from '../proofs/image-hash.service';

@Controller('trades')
@UseGuards(JwtAuthGuard)
export class TradesController {
  constructor(
    private readonly tradesService: TradesService,
    private readonly stateMachine: TradeStateMachine,
    private readonly storageService: StorageService,
    private readonly exifService: ExifService,
    private readonly imageHashService: ImageHashService,
    private readonly sightEngineService: SightEngineService,
  ) {}

  @Get()
  async getMyTrades(@CurrentUser() user: JwtPayload) {
    return this.tradesService.findByUser(user.sub);
  }

  // Admin: all trades (must be BEFORE :id to avoid route collision)
  @Get('all')
  @Roles('moderator', 'admin')
  async getAllTrades(
    @Query('state') state?: string,
    @Query('riskLevel') riskLevel?: string,
  ) {
    return this.tradesService.findAll({
      state: state as TradeState | undefined,
      riskLevel: riskLevel as RiskLevel | undefined,
    });
  }

  @Get(':id')
  async getTrade(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    // Moderators/admins can view any trade; regular users only their own
    const isMod = user.role === 'moderator' || user.role === 'admin';
    const trade = isMod
      ? await this.tradesService.findOne(id)
      : await this.tradesService.findOneForUser(id, user.sub);
    return {
      ...trade,
      availableActions: this.stateMachine.getAvailableTransitions(trade),
    };
  }

  @Get(':id/events')
  async getTradeEvents(@Param('id') id: string) {
    return this.tradesService.getTradeEvents(id);
  }

  // Admin: get proof packages for a trade
  @Get(':id/proof-packages')
  @Roles('moderator', 'admin')
  async getProofPackages(@Param('id') id: string) {
    return this.tradesService.getProofPackages(id);
  }

  @Post(':id/lock')
  @HttpCode(HttpStatus.OK)
  async lockItems(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tradesService.lockItems(id, user.sub);
  }

  @Post('proof-upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FilesInterceptor('files', 20, {
    storage: memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 },
  }))
  async uploadProofFiles(@UploadedFiles() files: Express.Multer.File[]) {
    const results = await Promise.all(
      (files || []).map(async (file) => {
        const hash = createHash('sha256').update(file.buffer).digest('hex');
        const result = await this.storageService.upload('proofs', file.buffer, file.originalname, file.mimetype);

        // Extract EXIF metadata for images (anti-scam: flag old, AI-generated, or stripped photos)
        const exif = await this.exifService.extractMetadata(file.buffer, file.mimetype);

        // Compute perceptual hash for images (anti-scam: duplicate detection)
        let phash: string | null = null;
        let aiScore: number | null = null;
        if (file.mimetype.startsWith('image/')) {
          phash = await this.imageHashService.computePerceptualHash(file.buffer);
          aiScore = await this.sightEngineService.checkImage(file.buffer, file.originalname);
        }

        return {
          url: result.url || `/api/trades/proof-uploads/${result.key.split('/').pop()}`,
          originalName: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          hash,
          exif,
          phash,
          aiScore,
        };
      }),
    );
    return results;
  }

  @Public()
  @Get('proof-uploads/:filename')
  async serveProofFile(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const fallbackPath = join(process.cwd(), 'uploads-fallback', 'proofs', safeName);
    const legacyPath = join(process.cwd(), 'proof-uploads', safeName);
    const filePath = existsSync(fallbackPath) ? fallbackPath : legacyPath;
    if (!existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(filePath);
  }

  @Post(':id/submit-proof')
  @HttpCode(HttpStatus.OK)
  async submitProof(
    @Param('id') id: string,
    @Body() body: SubmitProofDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tradesService.submitProof(id, user.sub, body.items, body.metadata);
  }

  @Post(':id/begin-verification')
  @Roles('moderator', 'admin')
  @HttpCode(HttpStatus.OK)
  async beginVerification(@Param('id') id: string) {
    return this.tradesService.beginVerification(id);
  }

  @Post(':id/verify')
  @Roles('moderator', 'admin')
  @HttpCode(HttpStatus.OK)
  async verify(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tradesService.verify(id, user.sub);
  }

  @Post(':id/reject-verification')
  @Roles('moderator', 'admin')
  @HttpCode(HttpStatus.OK)
  async rejectVerification(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: RejectVerificationDto,
  ) {
    return this.tradesService.rejectVerification(id, user.sub, body.reason);
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async completeTrade(@Param('id') id: string) {
    return this.tradesService.completeTrade(id);
  }

  @Post(':id/confirm-receipt')
  @HttpCode(HttpStatus.OK)
  async confirmReceipt(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tradesService.confirmReceipt(id, user.sub);
  }

  @Post(':id/dispute')
  @HttpCode(HttpStatus.OK)
  async openDispute(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: OpenDisputeDto,
  ) {
    return this.tradesService.openDispute(id, user.sub, body.reason, body.description);
  }

  @Post(':id/set-shipping-method')
  @HttpCode(HttpStatus.OK)
  async setShippingMethod(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: SetShippingMethodDto,
  ) {
    return this.tradesService.setShippingMethod(id, user.sub, body.method);
  }

  @Post(':id/select-center')
  @HttpCode(HttpStatus.OK)
  async selectCenter(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { centerId: string },
  ) {
    return this.tradesService.selectCenter(id, user.sub, body.centerId);
  }

  @Post(':id/submit-address')
  @HttpCode(HttpStatus.OK)
  async submitAddress(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: SubmitAddressDto,
  ) {
    return this.tradesService.submitAddress(id, user.sub, body.address);
  }

  @Post(':id/confirm-local-pickup')
  @HttpCode(HttpStatus.OK)
  async confirmLocalPickup(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.tradesService.confirmLocalPickup(id, user.sub);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelTrade(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.tradesService.cancelTrade(id, user.sub);
  }
}
