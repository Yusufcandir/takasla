import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resendApiKey: string | undefined;
  private readonly fromEmail: string;

  constructor(private readonly config: ConfigService) {
    this.resendApiKey = this.config.get<string>('RESEND_API_KEY');
    this.fromEmail = this.config.get<string>('RESEND_FROM', 'onboarding@resend.dev');

    if (this.resendApiKey) {
      this.logger.log('Email service configured with Resend API');
    } else {
      this.logger.warn('RESEND_API_KEY not configured — emails will be logged to console');
    }
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:4000');
    const link = `${frontendUrl}/verify-email?token=${token}`;

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1e293b;">Welcome to Exchange Platform!</h2>
        <p style="color: #475569;">Click the button below to verify your email address and activate your account:</p>
        <a href="${link}" style="display: inline-block; background: #0f172a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">Verify Email</a>
        <p style="color: #94a3b8; font-size: 14px;">Or copy this link: <a href="${link}">${link}</a></p>
        <p style="color: #94a3b8; font-size: 14px;">This link expires in 24 hours.</p>
      </div>
    `;

    if (!this.resendApiKey) {
      this.logger.log(`Verification email (dev mode) for ${to}: ${link}`);
      return;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: [to],
          subject: 'Verify your email - Exchange Platform',
          html,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Resend API error ${response.status}: ${body}`);
      }

      this.logger.log(`Verification email sent to ${to} via Resend`);
    } catch (err) {
      this.logger.error(`Failed to send verification email to ${to}`, err);
      throw err;
    }
  }
}
