import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, Roles } from '@exchange/common';
import { JwtPayload } from '@exchange/shared-types';
import { FraudDetectionService } from './fraud-detection.service';

@Controller('fraud-flags')
@UseGuards(JwtAuthGuard)
export class FraudController {
  constructor(private readonly fraudService: FraudDetectionService) {}

  @Get()
  @Roles('moderator', 'admin')
  async getUnreviewed() {
    return this.fraudService.getUnreviewedFlags();
  }

  @Get('user/:userId')
  @Roles('moderator', 'admin')
  async getByUser(@Param('userId') userId: string) {
    return this.fraudService.getFlagsByUser(userId);
  }

  @Post(':id/review')
  @Roles('moderator', 'admin')
  async review(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { notes?: string },
  ) {
    return this.fraudService.reviewFlag(id, user.sub, body?.notes);
  }
}
