import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { DEFAULT_MASTER_LISTS } from './masters.defaults';
import { CreateMasterListDto, UpdateMasterListDto, CreateMasterItemDto, UpdateMasterItemDto } from './dto/masters.dto';

@Injectable()
export class MastersService {
  constructor(private readonly prisma: PrismaService) {}

  async seedDefaults(storeId: string) {
    for (const [i, def] of DEFAULT_MASTER_LISTS.entries()) {
      const list = await this.prisma.masterList.upsert({
        where: { storeId_key: { storeId, key: def.key } },
        update: { fields: (def.fields ?? undefined) as unknown as Prisma.InputJsonValue, usage: def.usage ?? [] },
        create: { storeId, key: def.key, label: def.label, fields: (def.fields ?? undefined) as unknown as Prisma.InputJsonValue, usage: def.usage ?? [], isSystem: true, position: i },
      });
      for (const [j, it] of def.items.entries()) {
        await this.prisma.masterItem.upsert({
          where: { listId_value: { listId: list.id, value: it.value } },
          update: {},
          create: { listId: list.id, value: it.value, label: it.label, metadata: it.metadata as Prisma.InputJsonValue, position: j },
        });
      }
    }
    return { ok: true };
  }

  listLists(storeId: string) {
    return this.prisma.masterList.findMany({
      where: { storeId },
      orderBy: [{ position: 'asc' }, { label: 'asc' }],
      include: { _count: { select: { items: true } } },
    });
  }

  async getList(storeId: string, key: string) {
    const list = await this.prisma.masterList.findFirst({
      where: { storeId, key },
      include: { items: { orderBy: [{ position: 'asc' }, { label: 'asc' }] } },
    });
    if (!list) throw new NotFoundException('Master list not found');
    return list;
  }

  async createList(storeId: string, dto: CreateMasterListDto) {
    const exists = await this.prisma.masterList.findUnique({ where: { storeId_key: { storeId, key: dto.key } } });
    if (exists) throw new BadRequestException('A master list with this key already exists');
    return this.prisma.masterList.create({ data: { storeId, key: dto.key, label: dto.label } });
  }

  async updateList(storeId: string, id: string, dto: UpdateMasterListDto) {
    await this.ownList(storeId, id);
    const { fields, ...rest } = dto;
    return this.prisma.masterList.update({
      where: { id },
      data: { ...rest, ...(fields !== undefined ? { fields: fields as unknown as Prisma.InputJsonValue } : {}) },
    });
  }

  async removeList(storeId: string, id: string) {
    const list = await this.ownList(storeId, id);
    if (list.isSystem) throw new BadRequestException('Built-in option lists cannot be deleted.');
    const [variantUse, specUse, catUse] = await Promise.all([
      this.countVariantsUsingKey(storeId, list.key),
      this.countProductsUsingSpecKey(storeId, list.key),
      this.prisma.category.count({ where: { storeId, OR: [{ attributeKeys: { has: list.key } }, { variantAxisKeys: { has: list.key } }] } }),
    ]);
    const used = variantUse + specUse + catUse;
    if (used > 0) throw new BadRequestException(`This list is still used across ${used} product / category setup${used === 1 ? '' : 's'}. Remove those references first, then delete the list.`);
    await this.prisma.masterList.delete({ where: { id } });
    return { ok: true };
  }

  async addItem(storeId: string, listId: string, dto: CreateMasterItemDto) {
    await this.ownList(storeId, listId);
    return this.prisma.masterItem.create({
      data: { listId, value: dto.value, label: dto.label ?? dto.value, metadata: dto.metadata as Prisma.InputJsonValue, position: dto.position ?? 0, isActive: dto.isActive ?? true },
    });
  }

  async updateItem(storeId: string, id: string, dto: UpdateMasterItemDto) {
    await this.ownItem(storeId, id);
    const { metadata, ...rest } = dto;
    return this.prisma.masterItem.update({
      where: { id },
      data: { ...rest, ...(metadata !== undefined ? { metadata: metadata as Prisma.InputJsonValue } : {}) },
    });
  }

  async removeItem(storeId: string, id: string) {
    const item = await this.prisma.masterItem.findFirst({ where: { id, list: { storeId } }, include: { list: { select: { key: true } } } });
    if (!item) throw new NotFoundException('Master item not found');
    const [variantUse, specUse] = await Promise.all([
      this.countVariantsUsingKey(storeId, item.list.key, item.value),
      this.countProductsUsingSpecKey(storeId, item.list.key, item.value),
    ]);
    const used = variantUse + specUse;
    if (used > 0) throw new BadRequestException(`This option is used by ${used} product${used === 1 ? '' : 's'}. Turn it off to hide it instead, or remove it from those products first.`);
    await this.prisma.masterItem.delete({ where: { id } });
    return { ok: true };
  }

  // Master values live as plain strings inside product JSON (no FK), so usage is checked here before delete.
  private async countVariantsUsingKey(storeId: string, key: string, value?: string) {
    const rows = value === undefined
      ? await this.prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "ProductVariant" v JOIN "Product" p ON v."productId" = p.id WHERE p."storeId" = ${storeId} AND jsonb_exists(v.attributes, ${key})`
      : await this.prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "ProductVariant" v JOIN "Product" p ON v."productId" = p.id WHERE p."storeId" = ${storeId} AND v.attributes->>${key} = ${value}`;
    return rows[0]?.n ?? 0;
  }

  private async countProductsUsingSpecKey(storeId: string, key: string, value?: string) {
    const match = JSON.stringify(value === undefined ? [{ key }] : [{ key, value }]);
    const rows = await this.prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "Product" WHERE "storeId" = ${storeId} AND specifications @> ${match}::jsonb`;
    return rows[0]?.n ?? 0;
  }

  private async ownList(storeId: string, id: string) {
    const list = await this.prisma.masterList.findFirst({ where: { id, storeId } });
    if (!list) throw new NotFoundException('Master list not found');
    return list;
  }

  private async ownItem(storeId: string, id: string) {
    const found = await this.prisma.masterItem.findFirst({ where: { id, list: { storeId } } });
    if (!found) throw new NotFoundException('Master item not found');
    return found;
  }
}
