import { IsString, IsUUID, IsOptional, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class AddressDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() street!: string;
  @IsString() @IsNotEmpty() city!: string;
  @IsString() @IsNotEmpty() state!: string;
  @IsString() @IsNotEmpty() postalCode!: string;
  @IsString() @IsNotEmpty() country!: string;
  @IsString() @IsNotEmpty() phone!: string;
  @IsString() @IsOptional() district?: string;
  @IsString() @IsOptional() email?: string;
}

export class CreateShipmentDto {
  @IsUUID() tradeId!: string;
  @IsUUID() recipientId!: string;
  @IsUUID() @IsOptional() listingId?: string;

  @ValidateNested()
  @Type(() => AddressDto)
  senderAddress!: AddressDto;

  @ValidateNested()
  @Type(() => AddressDto)
  recipientAddress!: AddressDto;
}

export class BuyLabelDto {
  @IsString()
  @IsNotEmpty()
  rateId!: string;
}
