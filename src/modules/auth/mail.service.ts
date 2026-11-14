import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Service handling transactional email dispatch (Email Verification, Password Reset) via Resend.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Sends email verification link to user.
   */
  async sendEmailVerification(email: string, verifyUrl: string): Promise<void> {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
        <h2>Verify your email address</h2>
        <p>Thank you for registering. Please click the button below to verify your email address:</p>
        <p style="margin: 24px 0;">
          <a href="${verifyUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Email</a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `;
    await this.sendEmail(email, 'Verify your email address - English Learning', html);
  }

  /**
   * Sends password reset link to user.
   */
  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px;">
        <h2>Reset your password</h2>
        <p>We received a request to reset your password. Click the button below to proceed:</p>
        <p style="margin: 24px 0;">
          <a href="${resetUrl}" style="background-color: #dc2626; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Reset Password</a>
        </p>
        <p style="color: #6b7280; font-size: 14px;">This link will expire soon. If you didn't request a password reset, please ignore this email.</p>
      </div>
    `;
    await this.sendEmail(email, 'Reset your password - English Learning', html);
  }

  private async sendEmail(to: string, subject: string, html: string): Promise<void> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const from = this.configService.get<string>('MAIL_FROM_ADDRESS') || 'noreply@englishlearning.com';

    if (!apiKey) {
      this.logger.warn(`Skip sending email to ${to}: RESEND_API_KEY is not configured`);
      return;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject,
          html,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Resend API error (${response.status}): ${errorText}`);
      } else {
        this.logger.log(`Email successfully dispatched to ${to} (Subject: "${subject}")`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to dispatch email to ${to}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
