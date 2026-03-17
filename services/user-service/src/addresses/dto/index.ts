import { IsString, IsBoolean, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateAddressDto {
  @IsString() @IsOptional() label?: string;
  @IsBoolean() @IsOptional() isDefault?: boolean;
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() street!: string;
  @IsString() @IsNotEmpty() city!: string;
  @IsString() @IsOptional() state?: string;
  @IsString() @IsOptional() postalCode?: string;
  @IsString() @IsNotEmpty() country!: string;
  @IsString() @IsNotEmpty() phone!: string;
  @IsString() @IsOptional() district?: string;
  @IsString() @IsOptional() neighbourhood?: string;
  @IsString() @IsOptional() email?: string;
  @IsString() @IsOptional() countryCode?: string;
  @IsString() @IsOptional() stateCode?: string;
  @IsString() @IsOptional() cityCode?: string;
}
