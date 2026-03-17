import { IsString, IsNumber, IsOptional, IsUUID, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCategoryDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsNumber()
  @Min(0)
  @Max(1)
  @Type(() => Number)
  riskWeight!: number;

  @IsUUID()
  @IsOptional()
  parentId?: string;
}
