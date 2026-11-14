import { Injectable, Logger } from '@nestjs/common';

export interface SendEmailPayload {
  to: string;
  subject: string;
  body: string;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async sendEmail(payload: SendEmailPayload): Promise<boolean> {
    this.logger.log(`Dispatching email to ${payload.to}: ${payload.subject}`);
    // Notification engine ready for email / push providers (SES, Resend, Sendgrid)
    return true;
  }
}
