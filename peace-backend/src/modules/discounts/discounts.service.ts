import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreateDiscountDto, UpdateDiscountDto, ListDiscountsDto } from './dto/discount.dto';

type Base = Omit<CreateDiscountDto, 'name'>;

@Injectable()
export class DiscountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(storeId: string, query: ListDiscountsDto) {
    const where: Prisma.DiscountWhereInput = {
      storeId,
      ...(query.method ? { method: query.method as Prisma.EnumDiscountMethodFilter } : {}),
      ...(query.search ? { OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { code: { contains: query.search, mode: 'insensitive' } }] } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.discount.findMany({ where, orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }], skip: (query.page - 1) * query.limit, take: query.limit, include: { _count: { select: { usages: true } } } }),
      this.prisma.discount.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async get(storeId: string, id: string) {
    const d = await this.prisma.discount.findFirst({ where: { id, storeId }, include: { _count: { select: { usages: true } } } });
    if (!d) throw new NotFoundException('Discount not found');
    return d;
  }

  async create(storeId: string, dto: CreateDiscountDto) {
    await this.assertCode(storeId, dto);
    return this.prisma.discount.create({ data: { storeId, name: dto.name, ...this.data(dto) } });
  }

  async update(storeId: string, id: string, dto: UpdateDiscountDto) {
    await this.own(storeId, id);
    await this.assertCode(storeId, dto, id);
    return this.prisma.discount.update({ where: { id }, data: { ...(dto.name !== undefined ? { name: dto.name } : {}), ...this.data(dto) } });
  }

  async remove(storeId: string, id: string) {
    const d = await this.get(storeId, id);
    if (d._count.usages > 0) throw new BadRequestException('This discount has already been used in orders. Turn it off (set inactive) instead of deleting, to keep your sales reports accurate.');
    await this.prisma.discount.delete({ where: { id } });
    return { ok: true };
  }

  private data(dto: Base) {
    const date = (v?: string) => (v === undefined ? undefined : v ? new Date(v) : null);
    return {
      method: dto.method as Prisma.DiscountCreateInput['method'],
      code: dto.method === 'CODE' ? dto.code : dto.code === undefined ? undefined : null,
      type: dto.type as Prisma.DiscountCreateInput['type'],
      value: dto.value,
      scope: dto.scope as Prisma.DiscountCreateInput['scope'],
      targetProductIds: dto.targetProductIds,
      targetCategoryIds: dto.targetCategoryIds,
      targetCollectionIds: dto.targetCollectionIds,
      minSubtotal: dto.minSubtotal,
      minQuantity: dto.minQuantity,
      customerGroupIds: dto.customerGroupIds,
      buyQuantity: dto.buyQuantity,
      getQuantity: dto.getQuantity,
      getDiscountPercent: dto.getDiscountPercent,
      tiers: (dto.tiers ?? undefined) as Prisma.InputJsonValue,
      startsAt: date(dto.startsAt),
      endsAt: date(dto.endsAt),
      usageLimit: dto.usageLimit,
      perCustomerLimit: dto.perCustomerLimit,
      priority: dto.priority,
      stackable: dto.stackable,
      isActive: dto.isActive,
      featuredInNewsletter: dto.featuredInNewsletter,
    };
  }

  private async assertCode(storeId: string, dto: Base, exceptId?: string) {
    if (dto.method !== 'CODE' || !dto.code) return;
    const clash = await this.prisma.discount.findFirst({ where: { storeId, code: dto.code, method: 'CODE', ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } });
    if (clash) throw new BadRequestException('A discount with this code already exists');
  }

  private async own(storeId: string, id: string) {
    const d = await this.prisma.discount.findFirst({ where: { id, storeId }, select: { id: true } });
    if (!d) throw new NotFoundException('Discount not found');
    return d;
  }
}
