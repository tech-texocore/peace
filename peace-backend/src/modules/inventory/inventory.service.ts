import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { NotificationsService } from '../../infra/notifications/notifications.service';

const LOW_STOCK = 5;

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(storeId: string, query: { search?: string; page?: number; limit?: number; lowOnly?: boolean; categoryId?: string; stockStatus?: 'in' | 'low' | 'out' }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 50);
    const where: Prisma.ProductVariantWhereInput = { product: { storeId, ...(query.categoryId ? { categoryId: query.categoryId } : {}) } };
    if (query.stockStatus === 'out') where.stock = 0;
    else if (query.stockStatus === 'low') where.stock = { gt: 0, lte: LOW_STOCK };
    else if (query.stockStatus === 'in') where.stock = { gt: LOW_STOCK };
    else if (query.lowOnly) where.stock = { lte: LOW_STOCK };
    if (query.search) where.OR = [{ sku: { contains: query.search, mode: 'insensitive' } }, { product: { title: { contains: query.search, mode: 'insensitive' }, storeId } }];

    const [rows, total, lowCount, outCount] = await Promise.all([
      this.prisma.productVariant.findMany({
        where, orderBy: [{ stock: 'asc' }], skip: (page - 1) * limit, take: limit,
        include: { product: { select: { id: true, title: true, slug: true, brand: { select: { name: true } }, media: { where: { type: 'IMAGE' }, orderBy: { position: 'asc' }, take: 1 } } } },
      }),
      this.prisma.productVariant.count({ where }),
      this.prisma.productVariant.count({ where: { product: { storeId }, stock: { gt: 0, lte: LOW_STOCK } } }),
      this.prisma.productVariant.count({ where: { product: { storeId }, stock: 0 } }),
    ]);
    return {
      items: rows.map((v) => ({
        id: v.id, sku: v.sku, stock: v.stock, attributes: v.attributes,
        price: Number(v.price), mrp: v.mrp != null ? Number(v.mrp) : null,
        product: v.product.title, productId: v.product.id, slug: v.product.slug, brand: v.product.brand?.name ?? null,
        image: v.product.media[0]?.url ?? null, low: v.stock > 0 && v.stock <= LOW_STOCK, out: v.stock === 0,
      })),
      total, page, limit, lowCount, outCount, threshold: LOW_STOCK,
    };
  }

  async movements(storeId: string, variantId: string) {
    return this.prisma.stockMovement.findMany({ where: { storeId, variantId }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  async adjust(storeId: string, variantId: string, delta: number, reason: string, note: string | undefined, actor: string | undefined) {
    if (!Number.isInteger(delta) || delta === 0) throw new BadRequestException('Adjustment must be a non-zero whole number');
    const variant = await this.prisma.productVariant.findFirst({ where: { id: variantId, product: { storeId } }, select: { id: true, stock: true } });
    if (!variant) throw new NotFoundException('Variant not found');
    const newStock = variant.stock + delta;
    if (newStock < 0) throw new BadRequestException('Stock cannot go below zero');

    await this.prisma.$transaction([
      this.prisma.productVariant.update({ where: { id: variantId }, data: { stock: newStock } }),
      this.prisma.stockMovement.create({ data: { storeId, variantId, delta, reason, note: note ?? null, actor: actor ?? null } }),
    ]);

    if (variant.stock <= 0 && newStock > 0) void this.notifyBackInStock(variantId);
    return { stock: newStock };
  }

  // ---------------- Back in stock ----------------
  async subscribe(variantId: string, email: string) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId }, select: { stock: true, product: { select: { storeId: true } } } });
    if (!variant) throw new NotFoundException('Product not found');
    if (variant.stock > 0) return { alreadyInStock: true };
    await this.prisma.backInStockSubscription.upsert({
      where: { variantId_email: { variantId, email } },
      update: { notified: false },
      create: { storeId: variant.product.storeId, variantId, email },
    });
    return { subscribed: true };
  }

  private async notifyBackInStock(variantId: string) {
    try {
      const subs = await this.prisma.backInStockSubscription.findMany({ where: { variantId, notified: false }, select: { id: true, email: true } });
      if (!subs.length) return;
      const v = await this.prisma.productVariant.findUnique({ where: { id: variantId }, select: { product: { select: { title: true, slug: true } } } });
      const title = v?.product.title ?? 'A product you wanted';
      for (const s of subs) {
        await this.notifications.sendEmail(s.email, `${title} is back in stock`, `<p>Good news! <b>${title}</b> is available again.</p><p>Grab it before it sells out.</p><p>— Peace</p>`);
      }
      await this.prisma.backInStockSubscription.updateMany({ where: { id: { in: subs.map((s) => s.id) } }, data: { notified: true } });
    } catch { /* non-blocking */ }
  }
}
