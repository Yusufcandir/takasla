import { IsString, IsUUID, IsOptional, MaxLength } from 'class-validator';

export class CreateOfferDto {
  @IsUUID()
  listingId!: string;

  @IsUUID()
  offeredListingId!: string;

  @IsUUID()
  listingOwnerId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  message?: string;
}

export class CounterOfferDto {
  @IsUUID()
  proposedListingId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  message?: string;
}
