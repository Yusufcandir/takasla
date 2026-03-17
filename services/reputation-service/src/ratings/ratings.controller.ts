import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser } from '@exchange/common';
import { JwtPayload } from '@exchange/shared-types';
import { RatingsService } from './ratings.service';
import { SubmitRatingDto } from './dto';

@Controller('ratings')
@UseGuards(JwtAuthGuard)
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  async submitRating(
    @CurrentUser() user: JwtPayload,
    @Body() body: SubmitRatingDto,
  ) {
    return this.ratingsService.submitRating(
      body.tradeId, user.sub, body.ratedUserId, body.score, body.comment,
    );
  }

  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string) {
    return this.ratingsService.findByUser(userId);
  }

  @Get('trade/:tradeId')
  async findByTrade(@Param('tradeId') tradeId: string) {
    return this.ratingsService.findByTrade(tradeId);
  }
}
