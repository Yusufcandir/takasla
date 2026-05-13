import { Controller, Post, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, Roles } from '@exchange/common';
import { TrustScoreService } from './trust-score.service';

@Controller('trust')
@UseGuards(JwtAuthGuard)
export class TrustController {
  constructor(private readonly trustScoreService: TrustScoreService) {}

  @Post('recalculate/:userId')
  @Roles('admin')
  async recalculate(@Param('userId') userId: string) {
    const score = await this.trustScoreService.recalculate(userId);
    return { userId, score };
  }
}
