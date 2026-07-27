import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreateCustomerGroupDto, UpdateCustomerGroupDto, ListCustomerGroupsDto } from './dto/customer-group.dto';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

@Injectable()
export class CustomerGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(storeId: string, query: ListCustomerGroupsDto) {
    const where: Prisma.CustomerGroupWhereInput = {
      storeId,
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.customerGroup.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { _count: { select: { users: true } } },
      }),
      this.prisma.customerGroup.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async get(storeId: string, id: string) {
    const group = await this.prisma.customerGroup.findFirst({ where: { id, storeId }, include: { _count: { select: { users: true } } } });
    if (!group) throw new NotFoundException('Customer group not found');
    return group;
  }

  async create(storeId: string, dto: CreateCustomerGroupDto) {
    if (dto.isDefault) await this.clearDefault(storeId);
    const slug = await this.uniqueSlug(storeId, dto.slug || dto.name);
    return this.prisma.customerGroup.create({ data: { storeId, name: dto.name, slug, description: dto.description, isDefault: dto.isDefault ?? false } });
  }

  async update(storeId: string, id: string, dto: UpdateCustomerGroupDto) {
    const current = await this.own(storeId, id);
    if (dto.isDefault) await this.clearDefault(storeId, id);
    const slug = dto.slug ? await this.uniqueSlug(storeId, dto.slug, id) : current.slug;
    return this.prisma.customerGroup.update({ where: { id }, data: { ...dto, slug } });
  }

  async remove(storeId: string, id: string) {
    const g = await this.own(storeId, id);
    if (g.isDefault) throw new BadRequestException('This is the default customer group and cannot be deleted. Make another group the default first.');
    await this.prisma.customerGroup.delete({ where: { id } });
    return { ok: true };
  }

  private async clearDefault(storeId: string, exceptId?: string) {
    await this.prisma.customerGroup.updateMany({ where: { storeId, isDefault: true, ...(exceptId ? { id: { not: exceptId } } : {}) }, data: { isDefault: false } });
  }

  private async uniqueSlug(storeId: string, base: string, exceptId?: string) {
    const root = slugify(base) || 'group';
    let slug = root;
    let n = 2;
    while (await this.prisma.customerGroup.findFirst({ where: { storeId, slug, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } })) {
      slug = `${root}-${n++}`;
    }
    return slug;
  }

  private async own(storeId: string, id: string) {
    const g = await this.prisma.customerGroup.findFirst({ where: { id, storeId } });
    if (!g) throw new NotFoundException('Customer group not found');
    return g;
  }
}
