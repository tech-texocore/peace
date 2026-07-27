export const SMS_PROVIDER = Symbol('SMS_PROVIDER');
export const WHATSAPP_PROVIDER = Symbol('WHATSAPP_PROVIDER');
export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
export const PUSH_PROVIDER = Symbol('PUSH_PROVIDER');

export interface SmsProvider {
  readonly name: string;
  send(to: string, message: string): Promise<void>;
}

export interface WhatsappProvider {
  readonly name: string;
  send(to: string, message: string, template?: { name: string; params?: string[] }): Promise<void>;
}

export interface EmailProvider {
  readonly name: string;
  send(to: string, subject: string, html: string): Promise<void>;
}

export interface PushProvider {
  readonly name: string;
  send(deviceToken: string, title: string, body: string, data?: Record<string, string>): Promise<void>;
}
