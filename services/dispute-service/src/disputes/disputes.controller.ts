import { Controller, Get, Post, Param, Body, UseGuards, UseInterceptors, UploadedFiles, Res } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, CurrentUser, Roles, Public, StorageService } from '@exchange/common';
import { JwtPayload } from '@exchange/shared-types';
import { DisputesService } from './disputes.service';
import { OpenDisputeDto, UploadEvidenceDto, ResolveDisputeDto, AppealDisputeDto, AddActionDto, CenterDecisionDto } from './dto';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { Response } from 'express';
import { existsSync } from 'fs';
import { createHash } from 'crypto';

@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(
    private readonly disputesService: DisputesService,
    private readonly storageService: StorageService,
  ) {}

  // Static routes MUST come before parameterised :id routes
  @Get('open')
  @Roles('moderator', 'admin')
  async findOpen() {
    return this.disputesService.findOpen();
  }

  @Get('user/:userId/count')
  async getUserDisputeCount(@Param('userId') userId: string) {
    const count = await this.disputesService.countByUser(userId);
    return { count };
  }

  @Get('trade/:tradeId')
  async findByTrade(@Param('tradeId') tradeId: string) {
    return this.disputesService.findByTrade(tradeId);
  }

  @Post('evidence-upload')
  @UseInterceptors(FilesInterceptor('files', 10, {
    storage: memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
  }))
  async uploadEvidenceFiles(@UploadedFiles() files: Express.Multer.File[]) {
    const results = await Promise.all(
      (files || []).map(async (file) => {
        const hash = createHash('sha256').update(file.buffer).digest('hex');
        const result = await this.storageService.upload('evidence', file.buffer, file.originalname, file.mimetype);
        return {
          url: result.url || `/api/disputes/evidence-uploads/${result.key.split('/').pop()}`,
          originalName: file.originalname,
          size: file.size,
          hash,
        };
      }),
    );
    return results;
  }

  @Public()
  @Get('evidence-uploads/:filename')
  async serveEvidenceFile(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const fallbackPath = join(process.cwd(), 'uploads-fallback', 'evidence', safeName);
    if (!existsSync(fallbackPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(fallbackPath);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.disputesService.findById(id);
  }

  @Post()
  async openDispute(
    @CurrentUser() user: JwtPayload,
    @Body() body: OpenDisputeDto,
  ) {
    return this.disputesService.openDispute(body.tradeId, user.sub, body.reason, body.description);
  }

  @Post(':id/evidence')
  async uploadEvidence(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: UploadEvidenceDto,
  ) {
    return this.disputesService.uploadEvidence(id, user.sub, body.type, body.url, body.description, body.fileHash);
  }

  @Post(':id/resolve')
  @Roles('moderator', 'admin')
  async resolve(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: ResolveDisputeDto,
  ) {
    return this.disputesService.resolve(
      id, user.sub, body.resolution, body.outcome ?? 'completed',
      body.outcomeType, body.compensationAction ?? 'no_refund' as any,
      body.compensationAmount, body.centerId,
    );
  }

  @Post(':id/center-received')
  @Roles('moderator', 'admin')
  async markCenterReceived(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.disputesService.markCenterReceived(id, user.sub);
  }

  @Post(':id/center-decision')
  @Roles('moderator', 'admin')
  async centerDecision(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: CenterDecisionDto,
  ) {
    return this.disputesService.finalizeCenterInspection(id, user.sub, body.decision, body.notes);
  }

  @Post(':id/appeal')
  async appeal(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: AppealDisputeDto,
  ) {
    return this.disputesService.appealDispute(id, user.sub, body.reason);
  }

  @Post(':id/action')
  @Roles('moderator', 'admin')
  async addAction(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: AddActionDto,
  ) {
    return this.disputesService.addModeratorAction(id, user.sub, body.actionType, body.notes);
  }
}
