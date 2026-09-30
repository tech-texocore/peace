import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { EmailService } from '../../infra/notifications/email.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}


  async notifyOne(storeId: string, id: string) {
    const sub = await this.prisma.backInStockSubscription.findFirst({
      where: { id, storeId },
      include: { variant: { select: { stock: true } } },
    });
    if (!sub) throw new NotFoundException('Request not found');
    if (sub.variant.stock <= 0) throw new BadRequestException('This item is still out of stock — restock it first.');
    await this.email.sendBackInStock(sub.variantId, sub.email);
    await this.prisma.backInStockSubscription.update({ where: { id }, data: { notified: true } });
    return { notified: 1 };
  }

  async notifyAllInStock(storeId: string) {
    const subs = await this.prisma.backInStockSubscription.findMany({
      where: { storeId, notified: false, variant: { stock: { gt: 0 } } },
      select: { id: true, email: true, variantId: true },
    });
    for (const s of subs) {
      await this.email.sendBackInStock(s.variantId, s.email);
    }
    if (subs.length) await this.prisma.backInStockSubscription.updateMany({ where: { id: { in: subs.map((s) => s.id) } }, data: { notified: true } });
    return { notified: subs.length };
  }

  async newsletter(storeId: string, q: { search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(100, q.limit ?? 25);
    const where: Prisma.NewsletterSubscriberWhereInput = { storeId, ...(q.search ? { email: { contains: q.search, mode: 'insensitive' } } : {}) };
    const [rows, total, active] = await Promise.all([
      this.prisma.newsletterSubscriber.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.newsletterSubscriber.count({ where }),
      this.prisma.newsletterSubscriber.count({ where: { storeId, status: 'SUBSCRIBED' } }),
    ]);
    return {
      items: rows.map((s) => ({ id: s.id, email: s.email, source: s.source, status: s.status, isMember: !!s.userId, createdAt: s.createdAt })),
      total, active, page, limit,
    };
  }

  async backInStock(storeId: string, q: { search?: string; page?: number; limit?: number; pending?: boolean }) {
    const page = Math.max(1, q.page ?? 1);
    const limit = Math.min(100, q.limit ?? 25);
    const where: Prisma.BackInStockSubscriptionWhereInput = {
      storeId,
      ...(q.pending ? { notified: false } : {}),
      ...(q.search ? { OR: [{ email: { contains: q.search, mode: 'insensitive' } }, { variant: { product: { title: { contains: q.search, mode: 'insensitive' } } } }] } : {}),
    };
    const [rows, total, pending] = await Promise.all([
      this.prisma.backInStockSubscription.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        include: { variant: { select: { sku: true, stock: true, attributes: true, product: { select: { id: true, title: true, slug: true, media: { where: { type: 'IMAGE' }, orderBy: { position: 'asc' }, take: 1 } } } } } },
      }),
      this.prisma.backInStockSubscription.count({ where }),
      this.prisma.backInStockSubscription.count({ where: { storeId, notified: false } }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id, email: r.email, notified: r.notified, createdAt: r.createdAt,
        product: r.variant.product.title, productId: r.variant.product.id, slug: r.variant.product.slug, image: r.variant.product.media[0]?.url ?? null,
        sku: r.variant.sku, stock: r.variant.stock, attributes: r.variant.attributes as Record<string, string> | null,
      })),
      total, pending, page, limit,
    };
  }

  async unsubscribe(token: string) {
    const target = this.email.readUnsubscribeToken(token);
    if (!target) throw new BadRequestException('This unsubscribe link is not valid.');
    await this.prisma.newsletterSubscriber.updateMany({ where: { storeId: target.storeId, email: { equals: target.email, mode: 'insensitive' } }, data: { status: 'UNSUBSCRIBED' } });
    return { unsubscribed: true, email: target.email };
  }
}
