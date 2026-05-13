import { Controller, Get, Post, Param, Body, UseGuards, Headers } from '@nestjs/common';
import { JwtAuthGuard, CurrentUser, IdempotencyGuard } from '@exchange/common';
import { JwtPayload } from '@exchange/shared-types';
import { OffersService } from './offers.service';
import { CreateOfferDto, CounterOfferDto } from './dto';

@Controller('offers')
@UseGuards(JwtAuthGuard)
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Post()
  @UseGuards(IdempotencyGuard)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateOfferDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.offersService.create(
      user.sub, body.listingId, body.offeredListingId,
      body.listingOwnerId, body.message, idempotencyKey,
    );
  }

  @Post(':id/accept')
  async accept(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.offersService.accept(id, user.sub);
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.offersService.reject(id, user.sub);
  }

  @Post(':id/cancel')
  async cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.offersService.cancel(id, user.sub);
  }

  @Post(':id/counter')
  async counterOffer(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: CounterOfferDto,
  ) {
    return this.offersService.counterOffer(id, user.sub, body.proposedListingId, body.message);
  }

  @Get('pending-count')
  async pendingCount(@CurrentUser() user: JwtPayload) {
    const count = await this.offersService.pendingReceivedCount(user.sub);
    return { count };
  }

  @Get('listing/:listingId')
  async findByListing(@Param('listingId') listingId: string) {
    return this.offersService.findByListing(listingId);
  }

  @Get('my')
  async findMyOffers(@CurrentUser() user: JwtPayload) {
    return this.offersService.findByUser(user.sub);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.offersService.findById(id);
  }
}
