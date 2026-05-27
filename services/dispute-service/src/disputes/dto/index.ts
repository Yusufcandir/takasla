import { IsString, IsUUID, IsOptional, IsEnum, IsIn, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { DisputeReason, DisputeOutcome, CompensationAction } from '@exchange/shared-types';

export class OpenDisputeDto {
  @IsUUID()
  tradeId!: string;

  @IsEnum(DisputeReason)
  reason!: DisputeReason;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UploadEvidenceDto {
  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsOptional()
  url?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  fileHash?: string;
}

export class ResolveDisputeDto {
  @IsString()
  @IsNotEmpty()
  resolution!: string;

  @IsIn(['completed', 'revoked'])
  outcome!: 'completed' | 'revoked';

  @IsEnum(DisputeOutcome)
  outcomeType!: DisputeOutcome;

  @IsEnum(CompensationAction)
  compensationAction!: CompensationAction;

  @IsOptional()
  @IsNumber()
  @Min(0)
  compensationAmount?: number;
}

export class AppealDisputeDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}

export class AddActionDto {
  @IsString()
  @IsNotEmpty()
  actionType!: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
