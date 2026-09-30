import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { EmailService } from './email.service';
import { EmailSamplesService } from './email-samples.service';
import {
  EMAIL_PROVIDER,
  PUSH_PROVIDER,
  SMS_PROVIDER,
  WHATSAPP_PROVIDER,
} from './channels';
import {
  ConsoleEmailProvider,
  ConsolePushProvider,
  ConsoleSmsProvider,
  ConsoleWhatsappProvider,
} from './providers/console.providers';
import { SmtpEmailProvider } from './providers/smtp-email.provider';

// Email goes out over SMTP once set in admin → Integrations. SMS, WhatsApp and
// push print to the server log until their real send() is wired.
@Global()
@Module({
  providers: [
    ConsoleEmailProvider,
    SmtpEmailProvider,
    { provide: EMAIL_PROVIDER, useExisting: SmtpEmailProvider },
    { provide: SMS_PROVIDER, useClass: ConsoleSmsProvider },
    { provide: WHATSAPP_PROVIDER, useClass: ConsoleWhatsappProvider },
    { provide: PUSH_PROVIDER, useClass: ConsolePushProvider },
    NotificationsService,
    EmailService,
    EmailSamplesService,
  ],
  exports: [NotificationsService, EmailService, EmailSamplesService, SmtpEmailProvider],
})
export class NotificationsModule {}
