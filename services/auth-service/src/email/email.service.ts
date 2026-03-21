import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly brevoApiKey: string | undefined;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private readonly config: ConfigService) {
    this.brevoApiKey = this.config.get<string>('BREVO_API_KEY');
    this.fromEmail = this.config.get<string>('SMTP_USER', 'noreply@exchange.local');
    this.fromName = 'Takasla';

    if (this.brevoApiKey) {
      this.logger.log('Email service configured with Brevo API');
    } else {
      this.logger.warn('BREVO_API_KEY not configured — emails will be logged to console');
    }
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:4000');
    const link = `${frontendUrl}/verify-email?token=${token}`;

    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #1e293b;">Welcome to Takasla!</h2>
        <p style="color: #475569;">Click the button below to verify your email address and activate your account:</p>
        <a href="${link}" style="display: inline-block; background: #0f172a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">Verify Email</a>
        <p style="color: #94a3b8; font-size: 14px;">Or copy this link: <a href="${link}">${link}</a></p>
        <p style="color: #94a3b8; font-size: 14px;">This link expires in 24 hours.</p>
      </div>
    `;

    if (!this.brevoApiKey) {
      this.logger.log(`Verification email (dev mode) for ${to}: ${link}`);
      return;
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': this.brevoApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: this.fromName, email: this.fromEmail },
          to: [{ email: to }],
          subject: 'Verify your email - Takasla',
          htmlContent: html,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Brevo API error ${response.status}: ${body}`);
      }

      this.logger.log(`Verification email sent to ${to} via Brevo`);
    } catch (err) {
      this.logger.error(`Failed to send verification email to ${to}`, err);
      throw err;
    }
  }
}
