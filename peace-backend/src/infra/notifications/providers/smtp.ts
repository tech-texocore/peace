import { createTransport, type Transporter } from 'nodemailer';
import type { IntegrationSettings } from '../../integrations/integration-fields';

export const smtpReady = (e: IntegrationSettings['email']) =>
  Boolean(e.smtpHost && e.fromAddress);

export function smtpTransport(e: IntegrationSettings['email']): Transporter {
  const port = Number(e.smtpPort) || 587;
  return createTransport({
    host: e.smtpHost,
    port,
    secure: port === 465,
    auth: e.smtpUser ? { user: e.smtpUser, pass: e.smtpPass } : undefined,
    connectionTimeout: 15_000,
  });
}
