import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { EMAIL_PROVIDER, PUSH_PROVIDER, SMS_PROVIDER, WHATSAPP_PROVIDER } from './channels';
import { ConsoleEmailProvider, ConsolePushProvider, ConsoleSmsProvider, ConsoleWhatsappProvider } from './providers/console.providers';
import { ClientEmailProvider, ClientPushProvider, ClientSmsProvider, ClientWhatsappProvider } from './providers/client.providers';

const pick = <A, B>(config: ConfigService, key: string, consoleImpl: A, clientImpl: B) =>
  config.get<string>(key) === 'console' ? consoleImpl : clientImpl;

@Global()
@Module({
  providers: [
    ConsoleSmsProvider, ConsoleWhatsappProvider, ConsoleEmailProvider, ConsolePushProvider,
    ClientSmsProvider, ClientWhatsappProvider, ClientEmailProvider, ClientPushProvider,
    {
      provide: SMS_PROVIDER,
      inject: [ConfigService, ConsoleSmsProvider, ClientSmsProvider],
      useFactory: (c: ConfigService, con: ConsoleSmsProvider, cli: ClientSmsProvider) =>
        pick(c, 'notifications.sms.provider', con, cli),
    },
    {
      provide: WHATSAPP_PROVIDER,
      inject: [ConfigService, ConsoleWhatsappProvider, ClientWhatsappProvider],
      useFactory: (c: ConfigService, con: ConsoleWhatsappProvider, cli: ClientWhatsappProvider) =>
        pick(c, 'notifications.whatsapp.provider', con, cli),
    },
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService, ConsoleEmailProvider, ClientEmailProvider],
      useFactory: (c: ConfigService, con: ConsoleEmailProvider, cli: ClientEmailProvider) =>
        pick(c, 'notifications.email.provider', con, cli),
    },
    {
      provide: PUSH_PROVIDER,
      inject: [ConfigService, ConsolePushProvider, ClientPushProvider],
      useFactory: (c: ConfigService, con: ConsolePushProvider, cli: ClientPushProvider) =>
        pick(c, 'notifications.push.provider', con, cli),
    },
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
