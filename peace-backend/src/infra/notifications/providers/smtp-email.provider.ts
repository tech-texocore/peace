import { Injectable } from '@nestjs/common';
import type { Transporter } from 'nodemailer';
import { IntegrationsService } from '../../integrations/integrations.service';
import type { EmailProvider } from '../channels';
import { ConsoleEmailProvider } from './console.providers';
import { smtpReady, smtpTransport } from './smtp';

// Sends through the SMTP account in admin → Integrations → Email (Gmail, Brevo,
// Zoho … any SMTP). Falls back to the server log until it is set up.
@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  readonly name = 'smtp';
  private transporter: Transporter | null = null;

  constructor(
    private readonly integrations: IntegrationsService,
    private readonly fallback: ConsoleEmailProvider,
  ) {
    integrations.onChange(() => (this.transporter = null));
  }

  get configured() {
    return smtpReady(this.integrations.current.email);
  }

  async send(to: string, subject: string, html: string): Promise<void> {
    const settings = this.integrations.current.email;
    if (!smtpReady(settings)) return this.fallback.send(to, subject);
    this.transporter ??= smtpTransport(settings);
    await this.transporter.sendMail({
      from: settings.fromAddress,
      to,
      subject,
      html,
    });
  }
}
