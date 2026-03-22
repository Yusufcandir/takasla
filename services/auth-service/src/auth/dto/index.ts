import { IsEmail, IsString, IsOptional, MinLength, IsUUID, IsNotEmpty, IsBoolean, Equals } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsOptional()
  displayName?: string;

  @IsBoolean()
  @IsOptional()
  kvkkConsent?: boolean;

  @IsBoolean()
  @IsOptional()
  termsConsent?: boolean;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class RefreshDto {
  @IsUUID()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class ResendVerificationDto {
  @IsEmail()
  email!: string;
}
