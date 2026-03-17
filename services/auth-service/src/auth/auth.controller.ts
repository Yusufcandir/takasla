import { Controller, Post, Delete, Get, Body, Param, Query, UnauthorizedException, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { Public, JwtAuthGuard, CurrentUser, Roles } from '@exchange/common';
import { JwtPayload } from '@exchange/shared-types';
import { RegisterDto, LoginDto, RefreshDto, ResendVerificationDto } from './dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('register')
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body.email, body.password, body.displayName ?? '');
  }

  @UseGuards(JwtAuthGuard)
  @Roles('admin')
  @Post('register/moderator')
  async registerModerator(@Body() body: RegisterDto) {
    return this.authService.register(body.email, body.password, body.displayName ?? '', 'moderator');
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.email, body.password);
  }

  @Public()
  @Get('verify-email')
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  @Public()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Body() body: ResendVerificationDto) {
    return this.authService.resendVerification(body.email);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body.userId, body.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('account')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteOwnAccount(@CurrentUser() user: JwtPayload) {
    await this.usersService.deleteById(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Roles('moderator', 'admin')
  @Get('users')
  async listUsers() {
    return this.usersService.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @Roles('moderator', 'admin')
  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(@Param('id') id: string) {
    await this.usersService.deleteById(id);
  }
}
