import { Controller, Get, Post, Param, Body, UseGuards, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, Public } from '@exchange/common';
import { JwtPayload } from '@exchange/shared-types';
import { ShipmentsService } from './shipments.service';
import { CarrierProviderService } from '../carriers/carrier-provider.service';
import { CreateShipmentDto, BuyLabelDto } from './dto';
import { Request } from 'express';

@Controller('shipments')
@UseGuards(JwtAuthGuard)
export class ShipmentsController {
  constructor(
    private readonly shipmentsService: ShipmentsService,
    private readonly carrierProviderService: CarrierProviderService,
  ) {}

  @Post()
  async createShipment(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateShipmentDto,
  ) {
    return this.shipmentsService.createShipment({
      tradeId: body.tradeId,
      senderId: user.sub,
      recipientId: body.recipientId,
      listingId: body.listingId,
      senderAddress: body.senderAddress,
      recipientAddress: body.recipientAddress,
    });
  }

  @Get('trade/:tradeId')
  async getByTradeId(@Param('tradeId') tradeId: string) {
    return this.shipmentsService.getByTradeId(tradeId);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.shipmentsService.getById(id);
  }

  @Get(':id/rates')
  async getRates(@Param('id') id: string) {
    return this.shipmentsService.getRates(id);
  }

  @Post(':id/buy-label')
  @HttpCode(HttpStatus.OK)
  async buyLabel(
    @Param('id') id: string,
    @Body() body: BuyLabelDto,
  ) {
    return this.shipmentsService.buyLabel(id, body.rateId);
  }

  @Get(':id/tracking')
  async getTracking(@Param('id') id: string) {
    return this.shipmentsService.getTracking(id);
  }

  @Post(':id/simulate-progress')
  @HttpCode(HttpStatus.OK)
  async simulateProgress(@Param('id') id: string) {
    return this.shipmentsService.simulateShipmentProgress(id);
  }

  // Geliver webhook
  @Public()
  @Post('webhook/geliver')
  @HttpCode(HttpStatus.OK)
  async handleGeliverWebhook(@Req() req: Request, @Body() body: Record<string, unknown>) {
    const signature = req.headers['x-geliver-signature'] as string;
    const payload = JSON.stringify(body);

    const geliver = this.carrierProviderService.getProviderByName('geliver');
    if (geliver && !geliver.verifyWebhookSignature(payload, signature)) {
      return { error: 'Invalid signature' };
    }

    await this.shipmentsService.handleGeliverWebhook(body);
    return { received: true };
  }
}
