import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider, PushProvider, SmsProvider, WhatsappProvider } from '../channels';

@Injectable()
export class ConsoleSmsProvider implements SmsProvider {
  readonly name = 'console';
  private readonly logger = new Logger('SMS');
  async send(to: string, message: string): Promise<void> {
    this.logger.log(`[DEV SMS] → ${to}: ${message}`);
  }
}

@Injectable()
export class ConsoleWhatsappProvider implements WhatsappProvider {
  readonly name = 'console';
  private readonly logger = new Logger('WhatsApp');
  async send(to: string, message: string): Promise<void> {
    this.logger.log(`[DEV WhatsApp] → ${to}: ${message}`);
  }
}

@Injectable()
export class ConsoleEmailProvider implements EmailProvider {
  readonly name = 'console';
  private readonly logger = new Logger('Email');
  async send(to: string, subject: string): Promise<void> {
    this.logger.log(`[DEV Email] → ${to}: ${subject}`);
  }
}

@Injectable()
export class ConsolePushProvider implements PushProvider {
  readonly name = 'console';
  private readonly logger = new Logger('Push');
  async send(deviceToken: string, title: string, body: string): Promise<void> {
    this.logger.log(`[DEV Push] → ${deviceToken.slice(0, 12)}…: ${title} — ${body}`);
  }
}
