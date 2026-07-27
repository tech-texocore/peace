import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { NotificationsService } from '../../infra/notifications/notifications.service';
import { wants } from '../../common/notification-prefs';
import { resolveEngagement } from './engagement.config';

interface DispatchPayload { title: string; body: string; deepLink?: string }

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

@Injectable()
export class EngagementService {
  private readonly logger = new Logger(EngagementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async dispatch(storeId: string, userId: string, category: string, payload: DispatchPayload): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, phone: true, emailOptIn: true, smsOptIn: true, whatsappOptIn: true, notificationPrefs: true },
    });
    if (!user) return false;

    let delivered = false;
    if (wants(user, category, 'inApp')) {
      await this.prisma.notification.create({
        data: { storeId, userId, title: payload.title, body: payload.body, deepLink: payload.deepLink },
      });
      delivered = true;
    }
    if (user.email && wants(user, category, 'email')) {
      await this.notifications.sendEmail(user.email, payload.title, this.emailHtml(payload));
      delivered = true;
    }
    if (user.phone && wants(user, category, 'sms')) {
      await this.notifications.sendSms(user.phone, `${payload.title}: ${payload.body}`);
      delivered = true;
    }
    if (user.phone && wants(user, category, 'whatsapp')) {
      await this.notifications.sendWhatsapp(user.phone, `${payload.title}: ${payload.body}`);
      delivered = true;
    }
    return delivered;
  }

  async notifyPriceDrop(
    storeId: string,
    product: { id: string; slug: string; title: string },
    oldMin: number,
    newMin: number,
  ): Promise<number> {
    if (!(oldMin > 0) || !(newMin > 0) || newMin >= oldMin) return 0;
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { settings: true } });
    const cfg = resolveEngagement(store?.settings);
    const dropPct = ((oldMin - newMin) / oldMin) * 100;
    if (dropPct < cfg.priceDropMinPercent) return 0;

    const [wished, carted] = await Promise.all([
      this.prisma.wishlistItem.findMany({ where: { productId: product.id }, select: { userId: true } }),
      this.prisma.cartItem.findMany({ where: { productId: product.id }, select: { userId: true } }),
    ]);
    const userIds = Array.from(new Set([...wished, ...carted].map((r) => r.userId)));
    if (!userIds.length) return 0;

    const title = `Price drop on ${product.title}`;
    const body = `Now ${inr(newMin)} (was ${inr(oldMin)}) — ${Math.round(dropPct)}% off. Grab it before it's gone.`;
    let sent = 0;
    for (const userId of userIds) {
      if (await this.dispatch(storeId, userId, 'priceDrop', { title, body, deepLink: `/products/${product.slug}` })) sent++;
    }
    this.logger.log(`Price drop on ${product.slug}: notified ${sent}/${userIds.length} shoppers`);
    return sent;
  }

  async runAbandonedCartScan(storeId?: string): Promise<{ reminded: number }> {
    const stores = await this.prisma.store.findMany({
      where: storeId ? { id: storeId } : {},
      select: { id: true, settings: true },
    });
    const cfgByStore = new Map(stores.map((s) => [s.id, resolveEngagement(s.settings)]));
    const now = Date.now();
    const minThresholdHours = Math.min(...[...cfgByStore.values()].map((c) => c.abandonedCartHours), 1);

    const items = await this.prisma.cartItem.findMany({
      where: {
        reminderSentAt: null,
        updatedAt: { lte: new Date(now - minThresholdHours * 3_600_000) },
        product: storeId ? { storeId } : {},
      },
      select: {
        id: true, userId: true, updatedAt: true, quantity: true,
        product: { select: { storeId: true, slug: true, title: true } },
      },
    });

    const byUser = new Map<string, typeof items>();
    for (const it of items) {
      const cfg = cfgByStore.get(it.product.storeId);
      if (!cfg) continue;
      const ageMs = now - it.updatedAt.getTime();
      if (ageMs < cfg.abandonedCartHours * 3_600_000) continue;
      if (ageMs > cfg.abandonedCartMaxAgeHours * 3_600_000) continue;
      const list = byUser.get(it.userId) ?? [];
      list.push(it);
      byUser.set(it.userId, list);
    }

    let reminded = 0;
    for (const [userId, list] of byUser) {
      const first = list[0].product;
      const count = list.length;
      const title = 'You left something in your bag';
      const body = count === 1
        ? `“${first.title}” is still waiting for you. Complete your order before it sells out.`
        : `You have ${count} items waiting in your cart, including “${first.title}”. Complete your order before they sell out.`;
      const ok = await this.dispatch(first.storeId, userId, 'abandonedCart', { title, body, deepLink: '/cart' });
      await this.prisma.cartItem.updateMany({ where: { id: { in: list.map((l) => l.id) } }, data: { reminderSentAt: new Date() } });
      if (ok) reminded++;
    }
    if (reminded) this.logger.log(`Abandoned-cart scan: reminded ${reminded} shopper(s)`);
    return { reminded };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async handleAbandonedCartCron() {
    try {
      await this.runAbandonedCartScan();
    } catch (err) {
      this.logger.error('Abandoned-cart cron failed', err instanceof Error ? err.stack : String(err));
    }
  }

  private emailHtml(p: DispatchPayload) {
    const cta = p.deepLink
      ? `<p style="margin:24px 0"><a href="${p.deepLink}" style="background:#111;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:600">View</a></p>`
      : '';
    return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto"><h2 style="font-weight:600">${p.title}</h2><p style="color:#444;line-height:1.6">${p.body}</p>${cta}</div>`;
  }
}
