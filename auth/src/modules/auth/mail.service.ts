import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendEmailVerification(email: string, verifyUrl: string): Promise<void> {
    const html = `<p>Please verify your email address.</p><p><a href="${verifyUrl}">Verify Email</a></p>`;
    await this.sendEmail(email, 'Verify your email', html);
  }

  async sendPasswordReset(email: string, resetUrl: string): Promise<void> {
    const html = `<p>Reset your password.</p><p><a href="${resetUrl}">Reset Password</a></p>`;
    await this.sendEmail(email, 'Reset your password', html);
  }

  private async sendEmail(
    to: string,
    subject: string,
    html: string,
  ): Promise<void> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const from = this.configService.get<string>('MAIL_FROM_ADDRESS');

    if (!apiKey || !from) {
      this.logger.warn(
        `Skip sending email to ${to}: RESEND_API_KEY or MAIL_FROM_ADDRESS missing`,
      );
      return;
    }

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
      this.logger.error(`Resend failed: ${response.status} ${errorText}`);
      throw new Error('Failed to send email');
    }
  }
}
