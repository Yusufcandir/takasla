import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, HttpCode, HttpStatus, UseInterceptors, UploadedFiles, Res } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard, CurrentUser, Roles, Public } from '@exchange/common';
import { JwtPayload } from '@exchange/shared-types';
import { CentersService } from './centers.service';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { Response } from 'express';
import { existsSync } from 'fs';

@Controller('centers')
@UseGuards(JwtAuthGuard)
export class CentersController {
  constructor(private readonly centersService: CentersService) {}

  // --- Public: list active centers ---
  @Public()
  @Get()
  async listCenters() {
    return this.centersService.findAllCenters(true);
  }

  // --- Admin: list all centers (including inactive) ---
  @Get('all')
  @Roles('admin')
  async listAllCenters() {
    return this.centersService.findAllCenters(false);
  }

  // --- Admin: list pending verifications ---
  @Get('verifications/pending')
  @Roles('moderator', 'admin')
  async listPendingVerifications(@Query('centerId') centerId?: string) {
    return this.centersService.findPendingVerifications(centerId);
  }

  // --- Admin: list verifications by trade ---
  @Get('verifications/by-trade/:tradeId')
  @Roles('moderator', 'admin')
  async listVerificationsByTrade(@Param('tradeId') tradeId: string) {
    return this.centersService.findAllVerifications(tradeId);
  }

  // --- Admin: get verification detail ---
  @Get('verifications/:id')
  @Roles('moderator', 'admin')
  async getVerification(@Param('id') id: string) {
    return this.centersService.findVerificationById(id);
  }

  // --- Admin: mark item received at center ---
  @Post('verifications/:id/receive')
  @Roles('moderator', 'admin')
  @HttpCode(HttpStatus.OK)
  async markItemReceived(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.centersService.markItemReceived(id, user.sub);
  }

  // --- Admin: approve verification with photos ---
  @Post('verifications/:id/approve')
  @Roles('moderator', 'admin')
  @HttpCode(HttpStatus.OK)
  async approveVerification(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { notes?: string; photoUrls?: string[] },
  ) {
    return this.centersService.approveVerification(id, user.sub, body.notes, body.photoUrls);
  }

  // --- Admin: reject verification with reason ---
  @Post('verifications/:id/reject')
  @Roles('moderator', 'admin')
  @HttpCode(HttpStatus.OK)
  async rejectVerification(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { reason: string; photoUrls?: string[] },
  ) {
    return this.centersService.rejectVerification(id, user.sub, body.reason, body.photoUrls);
  }

  // --- Admin: upload verification photos ---
  @Post('verifications/upload-photos')
  @Roles('moderator', 'admin')
  @UseInterceptors(FilesInterceptor('files', 10, {
    storage: memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
  }))
  async uploadVerificationPhotos(@UploadedFiles() files: Express.Multer.File[]) {
    return this.centersService.uploadVerificationPhotos(files || []);
  }

  // Serve verification photos from fallback storage
  @Public()
  @Get('verification-uploads/:filename')
  async serveVerificationFile(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const fallbackPath = join(process.cwd(), 'uploads-fallback', 'center-verifications', safeName);
    if (!existsSync(fallbackPath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    return res.sendFile(fallbackPath);
  }

  // --- Public: get center details ---
  @Public()
  @Get(':id')
  async getCenterById(@Param('id') id: string) {
    return this.centersService.findCenterById(id);
  }

  // --- Admin: create center ---
  @Post()
  @Roles('admin')
  @HttpCode(HttpStatus.CREATED)
  async createCenter(@Body() body: {
    name: string;
    code: string;
    city: string;
    district: string;
    street: string;
    postalCode: string;
    country?: string;
    phone: string;
    email?: string;
    contactName: string;
    operatingHours?: string;
  }) {
    return this.centersService.createCenter(body);
  }

  // --- Admin: update center ---
  @Patch(':id')
  @Roles('admin')
  async updateCenter(
    @Param('id') id: string,
    @Body() body: Partial<{
      name: string;
      code: string;
      city: string;
      district: string;
      street: string;
      postalCode: string;
      country: string;
      phone: string;
      email: string;
      contactName: string;
      operatingHours: string;
      isActive: boolean;
    }>,
  ) {
    return this.centersService.updateCenter(id, body);
  }
}
