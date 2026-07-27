import { Injectable, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailProvider, PushProvider, SmsProvider, WhatsappProvider } from '../channels';

// Real providers — wire the HTTP call in send() once the client supplies keys.
// Selected by env (SMS_PROVIDER / WHATSAPP_PROVIDER / EMAIL_PROVIDER).

@Injectable()
export class ClientSmsProvider implements SmsProvider {
  readonly name = 'client';
  constructor(private readonly config: ConfigService) {}
  async send(_to: string, _message: string): Promise<void> {
    throw new NotImplementedException('SMS provider not configured — add SMS_API_KEY and implement send()');
  }
}

@Injectable()
export class ClientWhatsappProvider implements WhatsappProvider {
  readonly name = 'client';
  constructor(private readonly config: ConfigService) {}
  async send(_to: string, _message: string): Promise<void> {
    throw new NotImplementedException('WhatsApp provider not configured — add WHATSAPP_ACCESS_TOKEN and implement send()');
  }
}

@Injectable()
export class ClientEmailProvider implements EmailProvider {
  readonly name = 'client';
  constructor(private readonly config: ConfigService) {}
  async send(_to: string, _subject: string, _html: string): Promise<void> {
    throw new NotImplementedException('Email provider not configured — add SMTP settings and implement send()');
  }
}

@Injectable()
export class ClientPushProvider implements PushProvider {
  readonly name = 'client';
  constructor(private readonly config: ConfigService) {}
  async send(_deviceToken: string, _title: string, _body: string, _data?: Record<string, string>): Promise<void> {
    throw new NotImplementedException('Push provider not configured — add FCM credentials and implement send()');
  }
}
