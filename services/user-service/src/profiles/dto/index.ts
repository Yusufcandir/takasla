import { IsString, IsOptional } from 'class-validator';

export class UpdateProfileDto {
  @IsString() @IsOptional() displayName?: string;
  @IsString() @IsOptional() avatarUrl?: string;
  @IsString() @IsOptional() bio?: string;
  @IsString() @IsOptional() location?: string;
}
