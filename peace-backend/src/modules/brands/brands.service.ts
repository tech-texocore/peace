import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreateBrandDto, UpdateBrandDto, ListBrandsDto } from './dto/brand.dto';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

@Injectable()
export class BrandsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(storeId: string, query: ListBrandsDto) {
    const where: Prisma.BrandWhereInput = {
      storeId,
      ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.brand.findMany({
        where,
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { _count: { select: { products: true } } },
      }),
      this.prisma.brand.count({ where }),
    ]);
    return { items, total, page: query.page, limit: query.limit };
  }

  async get(storeId: string, id: string) {
    const brand = await this.prisma.brand.findFirst({ where: { id, storeId }, include: { _count: { select: { products: true } } } });
    if (!brand) throw new NotFoundException('Brand not found');
    return brand;
  }

  async create(storeId: string, dto: CreateBrandDto) {
    const slug = await this.uniqueSlug(storeId, dto.slug || dto.name);
    return this.prisma.brand.create({
      data: { storeId, name: dto.name, slug, logoUrl: dto.logoUrl, description: dto.description, position: dto.position ?? 0, isActive: dto.isActive ?? true },
    });
  }

  async update(storeId: string, id: string, dto: UpdateBrandDto) {
    const current = await this.own(storeId, id);
    const slug = dto.slug ? await this.uniqueSlug(storeId, dto.slug, id) : current.slug;
    return this.prisma.brand.update({ where: { id }, data: { ...dto, slug } });
  }

  async remove(storeId: string, id: string) {
    const brand = await this.get(storeId, id);
    if (brand._count.products > 0) throw new BadRequestException('Brand is used by products. Reassign them first.');
    await this.prisma.brand.delete({ where: { id } });
    return { ok: true };
  }

  private async uniqueSlug(storeId: string, base: string, exceptId?: string) {
    const root = slugify(base) || 'brand';
    let slug = root;
    let n = 2;
    while (await this.prisma.brand.findFirst({ where: { storeId, slug, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } })) {
      slug = `${root}-${n++}`;
    }
    return slug;
  }

  private async own(storeId: string, id: string) {
    const b = await this.prisma.brand.findFirst({ where: { id, storeId } });
    if (!b) throw new NotFoundException('Brand not found');
    return b;
  }
}
