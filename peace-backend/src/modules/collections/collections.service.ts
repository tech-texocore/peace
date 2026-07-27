import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreateCollectionDto, UpdateCollectionDto, ListCollectionsDto } from './dto/collection.dto';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

@Injectable()
export class CollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(storeId: string, query: ListCollectionsDto) {
    const where: Prisma.CollectionWhereInput = {
      storeId,
      ...(query.type ? { type: query.type } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.collection.findMany({
        where,
        orderBy: [{ position: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { _count: { select: { productLinks: true } } },
      }),
      this.prisma.collection.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async get(storeId: string, id: string) {
    const collection = await this.prisma.collection.findFirst({
      where: { id, storeId },
      include: {
        _count: { select: { productLinks: true } },
        productLinks: { orderBy: { position: 'asc' }, include: { product: { select: { id: true, title: true, slug: true } } } },
      },
    });
    if (!collection) throw new NotFoundException('Collection not found');
    return collection;
  }

  async create(storeId: string, dto: CreateCollectionDto) {
    const slug = await this.uniqueSlug(storeId, dto.slug || dto.title);
    return this.prisma.collection.create({
      data: {
        storeId,
        title: dto.title,
        slug,
        description: dto.description,
        imageUrl: dto.imageUrl,
        type: dto.type ?? 'MANUAL',
        rules: (dto.rules ?? undefined) as unknown as Prisma.InputJsonValue,
        sortOrder: (dto.sortOrder as Prisma.CollectionCreateInput['sortOrder']) ?? 'MANUAL',
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
        position: dto.position ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(storeId: string, id: string, dto: UpdateCollectionDto) {
    const current = await this.own(storeId, id);
    const slug = dto.slug ? await this.uniqueSlug(storeId, dto.slug, id) : current.slug;
    const { rules, sortOrder, ...rest } = dto;
    return this.prisma.collection.update({
      where: { id },
      data: {
        ...rest,
        slug,
        ...(rules !== undefined ? { rules: rules as unknown as Prisma.InputJsonValue } : {}),
        ...(sortOrder !== undefined ? { sortOrder: sortOrder as Prisma.CollectionUpdateInput['sortOrder'] } : {}),
      },
    });
  }

  async remove(storeId: string, id: string) {
    await this.own(storeId, id);
    await this.prisma.collection.delete({ where: { id } });
    return { ok: true };
  }

  async setProducts(storeId: string, id: string, productIds: string[]) {
    await this.own(storeId, id);
    const owned = await this.prisma.product.findMany({ where: { id: { in: productIds }, storeId }, select: { id: true } });
    const valid = productIds.filter((pid) => owned.some((p) => p.id === pid));
    await this.prisma.$transaction([
      this.prisma.collectionProduct.deleteMany({ where: { collectionId: id } }),
      ...valid.map((pid, i) => this.prisma.collectionProduct.create({ data: { collectionId: id, productId: pid, position: i } })),
    ]);
    return { ok: true, count: valid.length };
  }

  private async uniqueSlug(storeId: string, base: string, exceptId?: string) {
    const root = slugify(base) || 'collection';
    let slug = root;
    let n = 2;
    while (await this.prisma.collection.findFirst({ where: { storeId, slug, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } })) {
      slug = `${root}-${n++}`;
    }
    return slug;
  }

  private async own(storeId: string, id: string) {
    const c = await this.prisma.collection.findFirst({ where: { id, storeId } });
    if (!c) throw new NotFoundException('Collection not found');
    return c;
  }
}
