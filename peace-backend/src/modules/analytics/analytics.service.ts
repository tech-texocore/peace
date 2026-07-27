import { Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

const REVENUE_STATUSES: OrderStatus[] = ['CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED'];
const LOW_STOCK = 5;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(storeId: string) {
    const since = new Date(Date.now() - 13 * 86_400_000);
    since.setHours(0, 0, 0, 0);

    const [agg, statusCounts, recent, trendOrders, orderItems, lowStock, pendingReturns, pendingReviews, customers, activeProducts] = await Promise.all([
      this.prisma.order.aggregate({ where: { storeId, status: { in: REVENUE_STATUSES } }, _sum: { total: true }, _count: true }),
      this.prisma.order.groupBy({ by: ['status'], where: { storeId }, _count: true }),
      this.prisma.order.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' }, take: 6, select: { id: true, orderNumber: true, total: true, status: true, createdAt: true, user: { select: { name: true, email: true } } } }),
      this.prisma.order.findMany({ where: { storeId, status: { in: REVENUE_STATUSES }, createdAt: { gte: since } }, select: { createdAt: true, total: true } }),
      this.prisma.orderItem.findMany({ where: { order: { storeId, status: { in: REVENUE_STATUSES } } }, select: { productId: true, name: true, image: true, price: true, quantity: true } }),
      this.prisma.productVariant.count({ where: { product: { storeId }, stock: { lte: LOW_STOCK } } }),
      this.prisma.returnRequest.count({ where: { storeId, status: 'REQUESTED' } }),
      this.prisma.review.count({ where: { storeId, status: 'PENDING' } }),
      this.prisma.user.count({ where: { role: 'CUSTOMER', orders: { some: { storeId } } } }),
      this.prisma.product.count({ where: { storeId, status: 'ACTIVE' } }),
    ]);

    const revenue = Number(agg._sum.total ?? 0);
    const orders = agg._count;

    // Daily revenue for the last 14 days.
    const days: { date: string; label: string; revenue: number }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(since.getTime() + i * 86_400_000);
      days.push({ date: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), revenue: 0 });
    }
    const byDate = new Map(days.map((d) => [d.date, d]));
    for (const o of trendOrders) {
      const key = o.createdAt.toISOString().slice(0, 10);
      const bucket = byDate.get(key);
      if (bucket) bucket.revenue += Number(o.total);
    }

    // Top products by revenue.
    const map = new Map<string, { productId: string; name: string; image: string | null; units: number; revenue: number }>();
    let unitsSold = 0;
    for (const it of orderItems) {
      unitsSold += it.quantity;
      const cur = map.get(it.productId) ?? { productId: it.productId, name: it.name, image: it.image, units: 0, revenue: 0 };
      cur.units += it.quantity;
      cur.revenue += Number(it.price) * it.quantity;
      map.set(it.productId, cur);
    }
    const topProducts = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    return {
      revenue,
      orders,
      aov: orders ? Math.round(revenue / orders) : 0,
      unitsSold,
      statusCounts: Object.fromEntries(statusCounts.map((s) => [s.status, s._count])),
      trend: days,
      topProducts,
      lowStock,
      customers,
      activeProducts,
      pending: { returns: pendingReturns, reviews: pendingReviews },
      recent: recent.map((o) => ({ id: o.id, orderNumber: o.orderNumber, total: Number(o.total), status: o.status, createdAt: o.createdAt, customer: o.user.name ?? o.user.email })),
    };
  }
}
