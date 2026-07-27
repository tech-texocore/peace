import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Category } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async tree(storeId: string) {
    const all = await this.prisma.category.findMany({
      where: { storeId },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true, children: true } } },
    });
    return this.nest(all, null);
  }

  private nest(all: (Category & { _count?: unknown })[], parentId: string | null): unknown[] {
    return all
      .filter((c) => c.parentId === parentId)
      .map((c) => ({ ...c, children: this.nest(all, c.id) }));
  }

  async get(storeId: string, id: string) {
    const cat = await this.prisma.category.findFirst({ where: { id, storeId }, include: { _count: { select: { products: true, children: true } } } });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }

  async create(storeId: string, dto: CreateCategoryDto) {
    const parent = dto.parentId ? await this.own(storeId, dto.parentId) : null;
    const slug = await this.uniqueSlug(storeId, dto.slug || dto.name);
    return this.prisma.category.create({
      data: {
        storeId,
        name: dto.name,
        slug,
        parentId: parent?.id ?? null,
        path: parent ? `${parent.path}/${slug}` : slug,
        description: dto.description,
        imageUrl: dto.imageUrl,
        attributeKeys: dto.attributeKeys ?? [],
        variantAxisKeys: dto.variantAxisKeys ?? [],
        position: dto.position ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(storeId: string, id: string, dto: UpdateCategoryDto) {
    const cat = await this.own(storeId, id);

    let parent: Category | null | undefined;
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) throw new BadRequestException('A category cannot be its own parent');
      parent = dto.parentId ? await this.own(storeId, dto.parentId) : null;
      if (parent && (await this.isDescendant(id, parent.id))) throw new BadRequestException('Cannot move a category under its own descendant');
    }

    const slug = dto.slug ? await this.uniqueSlug(storeId, dto.slug, id) : cat.slug;
    const effectiveParent = parent !== undefined ? parent : cat.parentId ? await this.prisma.category.findUnique({ where: { id: cat.parentId } }) : null;
    const path = effectiveParent ? `${effectiveParent.path}/${slug}` : slug;

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        name: dto.name,
        slug,
        parentId: parent !== undefined ? (parent?.id ?? null) : undefined,
        path,
        description: dto.description,
        imageUrl: dto.imageUrl,
        attributeKeys: dto.attributeKeys,
        variantAxisKeys: dto.variantAxisKeys,
        position: dto.position,
        isActive: dto.isActive,
      },
    });
    await this.reindex(id, path);
    return updated;
  }

  async reorder(storeId: string, orderedIds: string[]) {
    const owned = await this.prisma.category.findMany({ where: { id: { in: orderedIds }, storeId }, select: { id: true } });
    const ids = new Set(owned.map((c) => c.id));
    await this.prisma.$transaction(orderedIds.filter((id) => ids.has(id)).map((id, i) => this.prisma.category.update({ where: { id }, data: { position: i } })));
    return { ok: true };
  }

  async remove(storeId: string, id: string) {
    const cat = await this.get(storeId, id);
    if (cat._count.children > 0) throw new BadRequestException('Move or delete the sub-categories first.');
    if (cat._count.products > 0) throw new BadRequestException(`This category has ${cat._count.products} product${cat._count.products === 1 ? '' : 's'}. Move them to another category first.`);
    await this.prisma.category.delete({ where: { id } });
    return { ok: true };
  }

  private async reindex(parentId: string, parentPath: string) {
    const children = await this.prisma.category.findMany({ where: { parentId } });
    for (const child of children) {
      const path = `${parentPath}/${child.slug}`;
      await this.prisma.category.update({ where: { id: child.id }, data: { path } });
      await this.reindex(child.id, path);
    }
  }

  private async isDescendant(nodeId: string, candidateId: string): Promise<boolean> {
    let current: string | null = candidateId;
    while (current) {
      if (current === nodeId) return true;
      const node = await this.prisma.category.findUnique({ where: { id: current }, select: { parentId: true } });
      current = node?.parentId ?? null;
    }
    return false;
  }

  private async uniqueSlug(storeId: string, base: string, exceptId?: string) {
    const root = slugify(base) || 'category';
    let slug = root;
    let n = 2;
    while (await this.prisma.category.findFirst({ where: { storeId, slug, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } })) {
      slug = `${root}-${n++}`;
    }
    return slug;
  }

  private async own(storeId: string, id: string) {
    const cat = await this.prisma.category.findFirst({ where: { id, storeId } });
    if (!cat) throw new NotFoundException('Category not found');
    return cat;
  }
}
