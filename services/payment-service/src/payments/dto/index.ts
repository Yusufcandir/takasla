import { IsString, IsUUID, IsNumber, IsIn, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBoostDto {
  @IsUUID() userId!: string;
  @IsUUID() listingId!: string;
  @IsIn(['featured', 'spotlight']) tier!: 'featured' | 'spotlight';
  @IsNumber() @Type(() => Number) durationDays!: number;
  @IsNumber() @Min(0) @Type(() => Number) amount!: number;
  @IsString() currency!: string;
}
