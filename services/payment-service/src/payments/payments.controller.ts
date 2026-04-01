import { Controller, Get, Post, Param, Body, Res, UseGuards, HttpCode, HttpStatus, Logger, Query } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, Public } from '@exchange/common';
import { JwtPayload } from '@exchange/shared-types';
import { PaymentsService } from './payments.service';
import { IyzicoService } from '../iyzico/iyzico.service';
import { CreateBoostDto, CreateInsuranceDto } from './dto';
import { Response } from 'express';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly iyzicoService: IyzicoService,
  ) {}

  @Get('trade/:tradeId')
  @UseGuards(JwtAuthGuard)
  async getByTrade(@Param('tradeId') tradeId: string) {
    return this.paymentsService.findByTrade(tradeId);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  async getMyPayments(@CurrentUser() user: JwtPayload) {
    return this.paymentsService.findByUser(user.sub);
  }

  @Post('create-boost')
  @HttpCode(HttpStatus.CREATED)
  async createBoostPayment(@Body() body: CreateBoostDto) {
    return this.paymentsService.createBoostPayment(
      body.userId,
      body.listingId,
      body.tier,
      body.durationDays,
      body.amount,
      body.currency,
    );
  }

  @Post('insurance')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createInsurance(
    @Body() body: CreateInsuranceDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.paymentsService.createInsurancePayment(body.tradeId, user.sub, body.riskLevel);
  }

  @Post(':id/checkout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async createCheckout(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // When iyzico is not configured, auto-complete the payment (simulation mode)
    if (!this.iyzicoService.isConfigured()) {
      await this.paymentsService.handleSimulatedPayment(id, user.sub);
      return { simulated: true };
    }
    return this.paymentsService.createCheckoutSession(id, user.sub);
  }

  @Post(':id/simulate-payment')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async simulatePayment(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    // Only available when iyzico is not configured (dev/test mode)
    if (this.iyzicoService.isConfigured()) {
      return { error: 'Simulation not available when iyzico is configured' };
    }
    await this.paymentsService.handleSimulatedPayment(id, user.sub);
    return { success: true };
  }

  @Post(':id/cancel-insurance')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async cancelInsurance(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    await this.paymentsService.cancelInsurancePayment(id, user.sub);
    return { success: true };
  }

  // iyzico callback — iyzico redirects the user's browser here after payment
  @Public()
  @Post('iyzico/callback')
  async handleIyzicoCallback(
    @Body() body: { token?: string },
    @Res() res: Response,
  ) {
    const token = body.token;
    if (!token) {
      this.logger.warn('iyzico callback received without token');
      return res.redirect(`${this.paymentsService['frontendUrl']}/dashboard?payment=error`);
    }

    this.logger.log(`iyzico callback received, token: ${token}`);
    const { redirectUrl } = await this.paymentsService.handleIyzicoCallback(token);
    return res.redirect(redirectUrl);
  }
}
