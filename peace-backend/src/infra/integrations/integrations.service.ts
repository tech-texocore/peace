import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  INTEGRATION_FIELDS,
  MASK,
  type IntegrationGroup,
  type IntegrationSettings,
} from './integration-fields';
import { decrypt, encrypt } from './secret-box';
import { smtpReady, smtpTransport } from '../notifications/providers/smtp';

type Stored =
  { sealed: string } | Record<string, Record<string, string>> | null;

const empty = (): IntegrationSettings => ({
  razorpay: {},
  bharatship: {},
  email: {},
  sms: {},
  whatsapp: {},
});

// Integration keys live in the database (edited from admin → Integrations),
// encrypted with ENCRYPTION_KEY. Providers read the in-memory copy, which is
// refreshed on every save — no restart needed.
@Injectable()
export class IntegrationsService implements OnModuleInit {
  private readonly logger = new Logger(IntegrationsService.name);
  private cache: IntegrationSettings = empty();
  private listeners: Array<() => void> = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.reload();
  }

  get current(): IntegrationSettings {
    return this.cache;
  }

  onChange(listener: () => void) {
    this.listeners.push(listener);
  }

  async getMasked(storeId: string) {
    return this.mask(await this.read(storeId));
  }

  async update(storeId: string, patch: Record<string, Record<string, string>>) {
    const merged = await this.read(storeId);
    for (const group of Object.keys(INTEGRATION_FIELDS) as IntegrationGroup[]) {
      const fields = INTEGRATION_FIELDS[group] as Record<string, boolean>;
      for (const [key, raw] of Object.entries(patch?.[group] ?? {})) {
        if (!(key in fields) || typeof raw !== 'string') continue;
        const value = raw.trim();
        if (fields[key] && (!value || value === MASK)) continue;
        (merged[group] as Record<string, string>)[key] = value;
      }
    }
    const stored = { sealed: encrypt(JSON.stringify(merged), this.key) };
    await this.prisma.store.update({
      where: { id: storeId },
      data: { integrations: stored },
    });
    await this.reload();
    return this.mask(merged);
  }

  // Checks the saved keys against the provider — used by "Test connection".
  async test(
    group: string,
    to?: string,
  ): Promise<{ ok: boolean; message: string }> {
    try {
      if (group === 'email') {
        const settings = this.cache.email;
        if (!smtpReady(settings))
          return {
            ok: false,
            message: 'Add From address and SMTP host first.',
          };
        if (!to)
          return {
            ok: false,
            message: 'Your admin account has no email to send the test to.',
          };
        try {
          await smtpTransport(settings).sendMail({
            from: settings.fromAddress,
            to,
            subject: 'Peace — test email',
            html: '<p>Your email settings work. Order and verification emails will be sent from this address.</p>',
          });
          return { ok: true, message: `Test email sent to ${to}.` };
        } catch (e) {
          return { ok: false, message: `SMTP error: ${(e as Error).message}` };
        }
      }
      if (group === 'razorpay') {
        const { keyId, keySecret } = this.cache.razorpay;
        if (!keyId || !keySecret)
          return { ok: false, message: 'Add Key ID and Key Secret first.' };
        const res = await fetch(
          'https://api.razorpay.com/v1/payments?count=1',
          {
            headers: {
              Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
            },
          },
        );
        return res.ok
          ? {
              ok: true,
              message: `Connected (${keyId.startsWith('rzp_live_') ? 'live' : 'test'} mode).`,
            }
          : { ok: false, message: 'Razorpay rejected these keys.' };
      }
      if (group === 'bharatship') {
        const { email, password, apiBase } = this.cache.bharatship;
        if (!email || !password)
          return { ok: false, message: 'Add login email and password first.' };
        const res = await fetch(
          `${(apiBase || 'https://app.bharatship.com').replace(/\/$/, '')}/api/authToken`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          },
        );
        const body = (await res.json().catch(() => ({}))) as {
          token?: string;
          message?: string;
        };
        return res.ok && body.token
          ? { ok: true, message: 'Connected.' }
          : {
              ok: false,
              message: body.message ?? 'BharatShip rejected this login.',
            };
      }
      return {
        ok: false,
        message: 'Connection test is not available for this integration yet.',
      };
    } catch {
      return {
        ok: false,
        message: 'Could not reach the provider. Check the network or API URL.',
      };
    }
  }

  private get key(): string {
    const key = this.config.get<string>('security.encryptionKey');
    if (!key || !/^[0-9a-f]{64}$/i.test(key))
      throw new Error(
        'ENCRYPTION_KEY must be 64 hex characters (openssl rand -hex 32)',
      );
    return key;
  }

  private async read(storeId: string): Promise<IntegrationSettings> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { integrations: true },
    });
    return this.unpack(store?.integrations as Stored);
  }

  private unpack(stored: Stored): IntegrationSettings {
    const out = empty();
    if (!stored) return out;
    const plain =
      'sealed' in stored && typeof stored.sealed === 'string'
        ? (JSON.parse(decrypt(stored.sealed, this.key)) as Record<
            string,
            Record<string, string>
          >)
        : (stored as Record<string, Record<string, string>>);
    for (const group of Object.keys(out) as IntegrationGroup[])
      Object.assign(out[group], plain[group] ?? {});
    return out;
  }

  private mask(settings: IntegrationSettings) {
    const out: Record<string, Record<string, string>> = {};
    for (const group of Object.keys(INTEGRATION_FIELDS) as IntegrationGroup[]) {
      const fields = INTEGRATION_FIELDS[group] as Record<string, boolean>;
      out[group] = {};
      for (const [key, secret] of Object.entries(fields)) {
        const value = (settings[group] as Record<string, string>)[key] ?? '';
        out[group][key] = secret ? (value ? MASK : '') : value;
      }
    }
    return out;
  }

  private async reload() {
    const slug = this.config.get<string>('platform.defaultStoreSlug')!;
    const store = await this.prisma.store.findUnique({
      where: { slug },
      select: { integrations: true },
    });
    try {
      this.cache = this.unpack((store?.integrations as Stored) ?? null);
    } catch (e) {
      this.logger.error(
        `Could not read integration keys: ${(e as Error).message}`,
      );
      this.cache = empty();
    }
    this.listeners.forEach((l) => l());
  }
}
