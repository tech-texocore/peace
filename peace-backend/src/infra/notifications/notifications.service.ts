import { Inject, Injectable } from '@nestjs/common';
import { EMAIL_PROVIDER, PUSH_PROVIDER, SMS_PROVIDER, WHATSAPP_PROVIDER } from './channels';
import type { EmailProvider, PushProvider, SmsProvider, WhatsappProvider } from './channels';

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(SMS_PROVIDER) private readonly sms: SmsProvider,
    @Inject(WHATSAPP_PROVIDER) private readonly whatsapp: WhatsappProvider,
    @Inject(EMAIL_PROVIDER) private readonly email: EmailProvider,
    @Inject(PUSH_PROVIDER) private readonly push: PushProvider,
  ) {}

  sendSms(to: string, message: string): Promise<void> {
    return this.sms.send(to, message);
  }

  sendWhatsapp(to: string, message: string, template?: { name: string; params?: string[] }): Promise<void> {
    return this.whatsapp.send(to, message, template);
  }

  sendEmail(to: string, subject: string, html: string): Promise<void> {
    return this.email.send(to, subject, html);
  }

  sendPush(deviceToken: string, title: string, body: string, data?: Record<string, string>): Promise<void> {
    return this.push.send(deviceToken, title, body, data);
  }
}
