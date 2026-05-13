import { IsString, IsNumber, IsOptional, IsArray, IsEnum, IsBoolean, IsIn, IsNotEmpty, Min, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ItemCondition } from '@exchange/shared-types';

export class CreateListingDto {
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  declaredValue?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  categoryId!: string;

  @IsEnum(ItemCondition)
  condition!: ItemCondition;

  @IsArray()
  @IsString({ each: true })
  imageUrls!: string[];

  @IsString()
  @IsOptional()
  location?: string;

  @IsIn(['local_pickup', 'shipping', 'both'])
  @IsOptional()
  shippingOption?: 'local_pickup' | 'shipping' | 'both';

  @IsIn(['fixed', 'negotiable', 'offers_only'])
  @IsOptional()
  priceFlexibility?: 'fixed' | 'negotiable' | 'offers_only';

  @IsBoolean()
  @IsOptional()
  hasOriginalPackaging?: boolean;

  @IsBoolean()
  @IsOptional()
  hasPurchaseReceipt?: boolean;

  @IsBoolean()
  @IsOptional()
  hasCertificateOfAuthenticity?: boolean;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  minExchangeValue?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maxExchangeValue?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  preferredCategories?: string[];

  @IsOptional()
  imageAiScores?: Record<string, number>;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  imageThumbnailUrls?: string[];
}

export class UpdateListingDto {
  @IsString()
  @IsOptional()
  @MinLength(3)
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  @MinLength(10)
  description?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  declaredValue?: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsEnum(ItemCondition)
  @IsOptional()
  condition?: ItemCondition;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  imageUrls?: string[];

  @IsString()
  @IsOptional()
  location?: string;

  @IsIn(['local_pickup', 'shipping', 'both'])
  @IsOptional()
  shippingOption?: 'local_pickup' | 'shipping' | 'both';

  @IsIn(['fixed', 'negotiable', 'offers_only'])
  @IsOptional()
  priceFlexibility?: 'fixed' | 'negotiable' | 'offers_only';

  @IsBoolean()
  @IsOptional()
  hasOriginalPackaging?: boolean;

  @IsBoolean()
  @IsOptional()
  hasPurchaseReceipt?: boolean;

  @IsBoolean()
  @IsOptional()
  hasCertificateOfAuthenticity?: boolean;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  minExchangeValue?: number;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  maxExchangeValue?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  preferredCategories?: string[];

  @IsOptional()
  imageAiScores?: Record<string, number>;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  imageThumbnailUrls?: string[];
}

export class BoostListingDto {
  @IsIn(['featured', 'spotlight'])
  tier!: 'featured' | 'spotlight';
}

export class AskQuestionDto {
  @IsString()
  @IsNotEmpty()
  question!: string;
}

export class AnswerQuestionDto {
  @IsString()
  @IsNotEmpty()
  answer!: string;
}

export class AddReplyDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class CreateReportDto {
  @IsIn(['inappropriate_content', 'fraud_scam', 'wrong_category', 'duplicate', 'prohibited_item', 'other'])
  reason!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  description?: string;
}

export class ReviewReportDto {
  @IsIn(['reviewed', 'dismissed'])
  status!: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  adminNotes?: string;
}
