import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: { user, pass },
      });
    } else {
      this.logger.warn('SMTP_USER / SMTP_PASS not configured — emails will be logged to console');
      this.transporter = nodemailer.createTransport({ jsonTransport: true });
    }
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:4000');
    const link = `${frontendUrl}/verify-email?token=${token}`;

    const mailOptions = {
      from: `"Exchange Platform" <${this.config.get<string>('SMTP_USER', 'noreply@exchange.local')}>`,
      to,
      subject: 'Verify your email - Exchange Platform',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #1e293b;">Welcome to Exchange Platform!</h2>
          <p style="color: #475569;">Click the button below to verify your email address and activate your account:</p>
          <a href="${link}" style="display: inline-block; background: #0f172a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0;">Verify Email</a>
          <p style="color: #94a3b8; font-size: 14px;">Or copy this link: <a href="${link}">${link}</a></p>
          <p style="color: #94a3b8; font-size: 14px;">This link expires in 24 hours.</p>
        </div>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      if (info.envelope) {
        this.logger.log(`Verification email sent to ${to}`);
      } else {
        this.logger.log(`Verification email (dev mode) for ${to}: ${link}`);
      }
    } catch (err) {
      this.logger.error(`Failed to send verification email to ${to}`, err);
      throw err;
    }
  }
}
