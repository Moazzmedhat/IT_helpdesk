export interface EmailNotificationPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface IEmailNotifier {
  sendEmail(payload: EmailNotificationPayload): Promise<boolean>;
}

export class LoggingEmailNotifier implements IEmailNotifier {
  async sendEmail(payload: EmailNotificationPayload): Promise<boolean> {
    console.log(`[EmailNotifier] Sending email to: ${payload.to} | Subject: "${payload.subject}"`);
    return true;
  }
}

export const emailNotifier = new LoggingEmailNotifier();
