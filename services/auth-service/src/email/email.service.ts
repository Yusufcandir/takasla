import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly brevoApiKey: string | undefined;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly frontendUrl: string;

  constructor(private readonly config: ConfigService) {
    this.brevoApiKey = this.config.get<string>('BREVO_API_KEY');
    this.fromEmail = this.config.get<string>('SMTP_USER', 'noreply@exchange.local');
    this.fromName = 'Takasla';
    this.frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:4000');

    if (this.brevoApiKey) {
      this.logger.log('Email service configured with Brevo API');
    } else {
      this.logger.warn('BREVO_API_KEY not configured — emails will be logged to console');
    }
  }

  // --- Generic send ---

  async sendEmail(to: string, subject: string, htmlContent: string): Promise<void> {
    if (!this.brevoApiKey) {
      this.logger.log(`Email (dev mode) to ${to}: ${subject}`);
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
          subject,
          htmlContent,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`Brevo API error ${response.status}: ${body}`);
      }

      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (err) {
      this.logger.error(`Failed to send email to ${to}: ${subject}`, err);
      // Don't throw — moderation emails are non-critical
    }
  }

  // --- Verification (existing) ---

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    const link = `${this.frontendUrl}/verify-email?token=${token}`;

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

  // --- Moderation email templates ---

  private wrap(title: string, color: string, body: string): string {
    return `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <div style="background: ${color}; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
          <h2 style="color: white; margin: 0; font-size: 20px;">${title}</h2>
        </div>
        <div style="background: white; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
          ${body}
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">Takasla — Secure Exchange Platform</p>
        </div>
      </div>
    `;
  }

  private listingLink(listingId: string, listingTitle: string): string {
    const url = `${this.frontendUrl}/listings/${listingId}`;
    return `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; margin: 12px 0;">
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #475569;"><strong>Listing:</strong> ${listingTitle}</p>
        <a href="${url}" style="display: inline-block; background: #0f172a; color: white; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px;">View Listing</a>
      </div>
    `;
  }

  async sendFraudFlagReviewedEmail(to: string, data: {
    flagType: string;
    description: string;
    reviewNotes?: string;
    listingId?: string;
    listingTitle?: string;
  }): Promise<void> {
    const flagLabel = data.flagType.replace(/_/g, ' ');
    const body = `
      <p style="color: #475569;">Our moderation team has reviewed activity on your account.</p>
      <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 12px 0;">
        <p style="margin: 0 0 4px 0; color: #92400e; font-weight: bold;">Flag type: ${flagLabel}</p>
        <p style="margin: 0; color: #92400e; font-size: 14px;">${data.description}</p>
        ${data.reviewNotes ? `<p style="margin: 8px 0 0 0; color: #92400e; font-size: 14px;"><strong>Notes:</strong> ${data.reviewNotes}</p>` : ''}
      </div>
      ${data.listingId && data.listingTitle ? this.listingLink(data.listingId, data.listingTitle) : ''}
      <p style="color: #475569; font-size: 14px;">Please ensure your activity complies with our terms. Repeated violations may result in account suspension.</p>
    `;
    await this.sendEmail(to, 'Account Activity Review - Takasla', this.wrap('Account Activity Review', '#f59e0b', body));
  }

  async sendListingReportReviewedEmail(to: string, data: {
    listingTitle: string;
    listingId: string;
    reportReason: string;
    status: string;
    adminNotes?: string;
  }): Promise<void> {
    const outcome = data.status === 'reviewed' ? 'upheld' : 'dismissed';
    const body = `
      <p style="color: #475569;">A report on your listing has been reviewed by our moderation team.</p>
      ${this.listingLink(data.listingId, data.listingTitle)}
      <div style="background: #f8fafc; border-radius: 8px; padding: 12px; margin: 12px 0;">
        <p style="margin: 4px 0; font-size: 14px;"><strong>Reason:</strong> ${data.reportReason.replace(/_/g, ' ')}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Outcome:</strong> ${outcome}</p>
        ${data.adminNotes ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Notes:</strong> ${data.adminNotes}</p>` : ''}
      </div>
      <p style="color: #475569; font-size: 14px;">Please review our community guidelines to avoid future issues.</p>
    `;
    await this.sendEmail(to, `Listing Report Update - ${data.listingTitle}`, this.wrap('Listing Report Update', '#f59e0b', body));
  }

  async sendListingArchivedEmail(to: string, data: {
    listingTitle: string;
    listingId: string;
  }): Promise<void> {
    const body = `
      <p style="color: #475569;">Your listing has been removed by our moderation team for violating our community guidelines.</p>
      ${this.listingLink(data.listingId, data.listingTitle)}
      <p style="color: #475569; font-size: 14px;">If you believe this was a mistake, please contact support.</p>
    `;
    await this.sendEmail(to, `Listing Removed - ${data.listingTitle}`, this.wrap('Listing Removed', '#dc2626', body));
  }

  async sendDisputeResolvedEmail(to: string, data: {
    disputeId: string;
    resolution: string;
    outcomeType: string;
    compensationAction: string;
    compensationAmount?: number;
  }): Promise<void> {
    const body = `
      <p style="color: #475569;">Your dispute has been resolved by our moderation team.</p>
      <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 12px 0;">
        <p style="margin: 4px 0; font-size: 14px;"><strong>Outcome:</strong> ${data.outcomeType.replace(/_/g, ' ')}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Resolution:</strong> ${data.resolution}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Action:</strong> ${data.compensationAction.replace(/_/g, ' ')}</p>
        ${data.compensationAmount ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Compensation:</strong> ${data.compensationAmount} TRY</p>` : ''}
      </div>
      <p style="color: #475569; font-size: 14px;">You have <strong>72 hours</strong> to appeal this decision from the dispute page.</p>
    `;
    await this.sendEmail(to, 'Dispute Resolved - Takasla', this.wrap('Dispute Resolved', '#0f172a', body));
  }

  async sendBanNotificationEmail(to: string): Promise<void> {
    const body = `
      <p style="color: #475569;">Your account has been permanently banned from Takasla for violating our terms of service.</p>
      <div style="background: #fef2f2; border: 1px solid #dc2626; border-radius: 8px; padding: 16px; margin: 12px 0;">
        <p style="margin: 0; color: #991b1b; font-weight: bold;">This action is final.</p>
        <p style="margin: 8px 0 0 0; color: #991b1b; font-size: 14px;">Your account and all associated data have been removed. You will not be able to register again with this email address.</p>
      </div>
      <p style="color: #475569; font-size: 14px;">If you believe this is an error, you may contact support.</p>
    `;
    await this.sendEmail(to, 'Account Banned - Takasla', this.wrap('Account Banned', '#dc2626', body));
  }
}
