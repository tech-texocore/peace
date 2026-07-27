import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(storeId: string, query: { search?: string; page?: number; limit?: number; state?: string; groupId?: string }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, query.limit ?? 25);
    const where: Prisma.UserWhereInput = { role: 'CUSTOMER' };
    if (query.search) where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
      { phone: { contains: query.search } },
    ];
    if (query.state) where.addresses = { some: { state: query.state } };
    if (query.groupId) where.customerGroupId = query.groupId === 'none' ? null : query.groupId;

    const [users, total, states] = await Promise.all([
      this.prisma.user.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        select: {
          id: true, name: true, email: true, phone: true, createdAt: true,
          customerGroup: { select: { id: true, name: true } },
          addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }], take: 1, select: { city: true, state: true } },
        },
      }),
      this.prisma.user.count({ where }),
      this.prisma.address.findMany({ where: { user: { role: 'CUSTOMER' } }, distinct: ['state'], orderBy: { state: 'asc' }, select: { state: true } }),
    ]);

    const stats = await this.prisma.order.groupBy({
      by: ['userId'], where: { storeId, userId: { in: users.map((u) => u.id) }, status: { not: 'CANCELLED' } }, _count: true, _sum: { total: true },
    });
    const sm = new Map(stats.map((s) => [s.userId, { orders: s._count, spent: Number(s._sum.total ?? 0) }]));
    return {
      items: users.map(({ addresses, ...u }) => ({
        ...u,
        location: addresses[0] ? [addresses[0].city, addresses[0].state].filter(Boolean).join(', ') : null,
        orders: sm.get(u.id)?.orders ?? 0,
        spent: sm.get(u.id)?.spent ?? 0,
      })),
      total, page, limit,
      facets: { states: states.map((s) => s.state) },
    };
  }

  async detail(storeId: string, id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, phone: true, gender: true, dob: true, createdAt: true, customerGroup: { select: { id: true, name: true } }, addresses: true },
    });
    if (!user) throw new NotFoundException('Customer not found');
    const [orders, agg] = await Promise.all([
      this.prisma.order.findMany({ where: { storeId, userId: id }, orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, orderNumber: true, total: true, status: true, createdAt: true } }),
      this.prisma.order.aggregate({ where: { storeId, userId: id, status: { not: 'CANCELLED' } }, _count: true, _sum: { total: true } }),
    ]);
    return {
      ...user,
      orders: orders.map((o) => ({ ...o, total: Number(o.total) })),
      stats: { orders: agg._count, spent: Number(agg._sum.total ?? 0) },
    };
  }

  async assignGroup(storeId: string, id: string, customerGroupId: string | null) {
    if (customerGroupId) {
      const g = await this.prisma.customerGroup.findFirst({ where: { id: customerGroupId, storeId }, select: { id: true } });
      if (!g) throw new BadRequestException('Customer group not found');
    }
    await this.prisma.user.update({ where: { id }, data: { customerGroupId } });
    return { updated: true };
  }
}
