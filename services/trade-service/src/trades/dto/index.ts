import { IsString, IsArray, IsOptional, IsIn, IsNotEmpty, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class ProofItemDto {
  @IsString()
  type!: string;

  @IsString()
  url!: string;

  @IsString()
  hash!: string;
}

export class SubmitProofDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProofItemDto)
  items!: ProofItemDto[];

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>; // EXIF data and flags from upload step
}

export class RejectVerificationDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class OpenDisputeDto {
  @IsString()
  @IsOptional()
  reason?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class SetShippingMethodDto {
  @IsIn(['shipping', 'local_pickup'])
  method!: 'shipping' | 'local_pickup';
}

export class SubmitAddressDto {
  @IsObject()
  address!: Record<string, string>;
}
