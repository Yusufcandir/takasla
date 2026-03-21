import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { TokensModule } from '../tokens/tokens.module';
import { EmailModule } from '../email/email.module';
import { ModerationEmailListener } from '../email/moderation-email.listener';

@Module({
  imports: [UsersModule, TokensModule, EmailModule],
  controllers: [AuthController],
  providers: [AuthService, ModerationEmailListener],
})
export class AuthModule {}
