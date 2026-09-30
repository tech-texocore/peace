import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MediaService } from '../media/media.service';
import { NotificationsService } from './notifications.service';
import { absoluteUrl, renderEmail, type EmailBrand, type EmailContent } from './email-template';
import { backInStockEmail, type EmailLinks } from './email-content';

type SiteConfigJson = {
  brand?: { name?: string; tagline?: string; logo?: { url?: string } };
  theme?: { colors?: { accent?: string; accentForeground?: string } };
};
type SettingsJson = {
  contact?: { email?: string; phone?: string };
  social?: { instagram?: string; facebook?: string; youtube?: string };
};

const HEX = /^#[0-9a-f]{3,8}$/i;

@Injectable()
export class EmailService implements EmailLinks {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  get webUrl() {
    return (this.config.get<string[]>('app.corsOrigins')?.[0] ?? '').replace(/\/$/, '');
  }

  link(path: string) {
    return absoluteUrl(this.webUrl, path);
  }

  image(value: string | null | undefined) {
    return value ? this.media.resolve(value) : null;
  }

  // Signed one-click unsubscribe link for newsletter subscribers (no login needed).
  unsubscribeUrl(storeId: string, email: string) {
    const payload = Buffer.from(JSON.stringify([storeId, email.toLowerCase()])).toString('base64url');
    return this.link(`/unsubscribe?t=${payload}.${this.sign(payload)}`);
  }

  readUnsubscribeToken(token: string): { storeId: string; email: string } | null {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;
    const expected = Buffer.from(this.sign(payload));
    const given = Buffer.from(signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const [storeId, email] = JSON.parse(Buffer.from(payload, 'base64url').toString()) as [string, string];
      return typeof storeId === 'string' && typeof email === 'string' ? { storeId, email } : null;
    } catch {
      return null;
    }
  }

  private sign(payload: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('security.encryptionKey'))
      .update(`unsubscribe:${payload}`)
      .digest('base64url');
  }

  async brand(storeId: string): Promise<EmailBrand> {
    const store = await this.prisma.store.findUnique({
      where: { id: storeId },
      select: { name: true, settings: true, siteConfig: { select: { published: true, draft: true } } },
    });
    const site = (store?.siteConfig?.published ?? store?.siteConfig?.draft ?? {}) as SiteConfigJson;
    const settings = (store?.settings ?? {}) as SettingsJson;
    const logo = this.image(site.brand?.logo?.url);
    const colors = site.theme?.colors ?? {};
    const social = settings.social ?? {};
    return {
      name: site.brand?.name || store?.name || '',
      tagline: site.brand?.tagline || null,
      // Gmail and Outlook do not render SVG, so an SVG logo falls back to the brand name.
      logoUrl: logo && !/\.svg(\?|$)/i.test(logo) ? logo : null,
      accent: colors.accent && HEX.test(colors.accent) ? colors.accent : '#3c5341',
      accentForeground: colors.accentForeground && HEX.test(colors.accentForeground) ? colors.accentForeground : '#f6f3ec',
      webUrl: this.webUrl,
      supportEmail: settings.contact?.email || null,
      supportPhone: settings.contact?.phone || null,
      social: [
        social.instagram && { label: 'Instagram', url: social.instagram },
        social.facebook && { label: 'Facebook', url: social.facebook },
        social.youtube && { label: 'YouTube', url: social.youtube },
      ].filter((s): s is { label: string; url: string } => Boolean(s)),
    };
  }

  async render(storeId: string, content: EmailContent) {
    return renderEmail(content, await this.brand(storeId));
  }

  async send(storeId: string, to: string, subject: string, content: EmailContent) {
    await this.notifications.sendEmail(to, subject, await this.render(storeId, content));
  }

  async sendOrThrow(storeId: string, to: string, subject: string, content: EmailContent) {
    await this.notifications.sendEmailOrThrow(to, subject, await this.render(storeId, content));
  }

  async sendBackInStock(variantId: string, to: string) {
    const v = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      select: {
        price: true,
        mrp: true,
        attributes: true,
        product: {
          select: {
            storeId: true,
            title: true,
            slug: true,
            media: { where: { type: 'IMAGE' }, orderBy: { position: 'asc' }, take: 1, select: { url: true } },
          },
        },
      },
    });
    if (!v) return;
    await this.send(
      v.product.storeId,
      to,
      `${v.product.title} is back in stock`,
      backInStockEmail(this, {
        title: v.product.title,
        slug: v.product.slug,
        image: v.product.media[0]?.url ?? null,
        attributes: v.attributes,
        price: Number(v.price),
        mrp: v.mrp ? Number(v.mrp) : null,
      }),
    );
  }
}
