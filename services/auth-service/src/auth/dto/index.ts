import { IsEmail, IsString, IsOptional, MinLength, IsUUID, IsNotEmpty } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  @IsOptional()
  displayName?: string;
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
