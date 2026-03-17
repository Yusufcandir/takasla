import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { JwtAuthGuard, CurrentUser } from '@exchange/common';
import { JwtPayload } from '@exchange/shared-types';
import { CreateAddressDto } from './dto';

@Controller('addresses')
@UseGuards(JwtAuthGuard)
export class AddressesController {
  constructor(private readonly addressesService: AddressesService) {}

  @Get()
  async getAll(@CurrentUser() user: JwtPayload) {
    return this.addressesService.findAllByUser(user.sub);
  }

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateAddressDto,
  ) {
    return this.addressesService.create(user.sub, body);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.addressesService.update(user.sub, id, body);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    await this.addressesService.remove(user.sub, id);
    return { deleted: true };
  }

  @Patch(':id/default')
  async setDefault(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.addressesService.setDefault(user.sub, id);
  }
}
