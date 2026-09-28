import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  EMAIL_PROVIDER,
  PUSH_PROVIDER,
  SMS_PROVIDER,
  WHATSAPP_PROVIDER,
} from './channels';
import type {
  EmailProvider,
  PushProvider,
  SmsProvider,
  WhatsappProvider,
} from './channels';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsappProvider,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(PUSH_PROVIDER) private readonly push: PushProvider,
  ) {}

  sendSms(to: string, message: string): Promise<void> {
    return this.sms.send(to, message);
  }

  sendWhatsapp(
    to: string,
    message: string,
    template?: { name: string; params?: string[] },
  ): Promise<void> {
    return this.whatsapp.send(to, message, template);
  }

  // A failed email never breaks the order / restock flow that triggered it.
  async sendEmail(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.email.send(to, subject, html);
    } catch (e) {
      this.logger.error(`Email to ${to} failed: ${(e as Error).message}`);
    }
  }

  // For OTPs and test emails — the caller needs to know if it failed.
  sendEmailOrThrow(to: string, subject: string, html: string): Promise<void> {
    return this.email.send(to, subject, html);
  }

  sendPush(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    return this.push.send(deviceToken, title, body, data);
  }
}
