import { IsString, IsUUID, IsNumber, IsOptional, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class SubmitRatingDto {
  @IsUUID() tradeId!: string;
  @IsUUID() ratedUserId!: string;
  @IsNumber() @Min(1) @Max(5) @Type(() => Number) score!: number;
  @IsString() @IsOptional() @MaxLength(2000) comment?: string;
}
