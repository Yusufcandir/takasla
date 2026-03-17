import { Controller, Get, Post, Patch, Param, Body, UseGuards, UseInterceptors, UploadedFile, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ProfilesService } from './profiles.service';
import { TrustService } from '../trust/trust.service';
import { JwtAuthGuard, CurrentUser, Public, StorageService } from '@exchange/common';
import { JwtPayload } from '@exchange/shared-types';
import { UpdateProfileDto } from './dto';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { Response } from 'express';
import { existsSync } from 'fs';

@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(
    private readonly profilesService: ProfilesService,
    private readonly trustService: TrustService,
    private readonly storageService: StorageService,
  ) {}

  @Get('me')
  async getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.profilesService.findByUserId(user.sub);
  }

  @Public()
  @Get('uploads/avatars/:filename')
  async serveAvatar(@Param('filename') filename: string, @Res() res: Response) {
    const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const fallbackPath = join(process.cwd(), 'uploads-fallback', 'avatars', safeName);
    const legacyPath = join(process.cwd(), 'uploads', 'avatars', safeName);
    const filePath = existsSync(fallbackPath) ? fallbackPath : legacyPath;
    if (!existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    return res.sendFile(filePath);
  }

  @Public()
  @Get(':userId')
  async getProfile(@Param('userId') userId: string) {
    return this.profilesService.findByUserId(userId);
  }

  @Public()
  @Get(':userId/trust')
  async getTrustScore(@Param('userId') userId: string) {
    return this.trustService.getUserTrustScore(userId);
  }

  @Post('upload-avatar')
  @UseInterceptors(FileInterceptor('avatar', { storage: memoryStorage() }))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    const result = await this.storageService.upload('avatars', file.buffer, file.originalname, file.mimetype);
    return {
      url: result.url || `/api/profiles/uploads/avatars/${result.key.split('/').pop()}`,
      originalName: file.originalname,
      size: file.size,
    };
  }

  @Patch()
  async updateProfile(
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateProfileDto,
  ) {
    return this.profilesService.update(user.sub, body);
  }
}
