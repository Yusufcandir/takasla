import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, Roles } from '@exchange/common';
import { JwtPayload } from '@exchange/shared-types';
import { DisputesService } from './disputes.service';
import { OpenDisputeDto, UploadEvidenceDto, ResolveDisputeDto, AppealDisputeDto, AddActionDto } from './dto';

@Controller('disputes')
@UseGuards(JwtAuthGuard)
export class DisputesController {
  constructor(private readonly disputesService: DisputesService) {}

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
      id, user.sub, body.resolution, body.outcome,
      body.outcomeType, body.compensationAction, body.compensationAmount,
    );
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
