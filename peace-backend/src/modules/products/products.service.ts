import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { EngagementService } from '../engagement/engagement.service';
import { CreateProductDto, UpdateProductDto, ListProductsDto, VariantDto, MediaDto, ProductBase } from './dto/product.dto';

type Tx = Prisma.TransactionClient;
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const json = (v: unknown) => (v === undefined ? undefined : (v as Prisma.InputJsonValue));

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engagement: EngagementService,
  ) {}

  async list(storeId: string, query: ListProductsDto) {
    const where: Prisma.ProductWhereInput = {
      storeId,
      ...(query.status ? { status: query.status as Prisma.EnumProductStatusFilter } : {}),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.search ? { OR: [{ title: { contains: query.search, mode: 'insensitive' as const } }, { brand: { name: { contains: query.search, mode: 'insensitive' as const } } }] } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: {
          seller: { select: { id: true, name: true } },
          category: { select: { id: true, name: true } },
          brand: { select: { id: true, name: true } },
          media: { where: { type: 'IMAGE' }, orderBy: { position: 'asc' }, take: 1 },
          variants: { select: { price: true, mrp: true, stock: true } },
          _count: { select: { variants: true } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    const items = rows.map(({ variants, ...p }) => {
      const prices = variants.map((v) => Number(v.price));
      return {
        ...p,
        priceFrom: prices.length ? Math.min(...prices) : null,
        stock: variants.reduce((s, v) => s + v.stock, 0),
      };
    });
    return { items, total, page: query.page, limit: query.limit };
  }

  async get(storeId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, storeId },
      include: {
        seller: { select: { id: true, name: true } },
        category: { select: { id: true, name: true, path: true } },
        brand: { select: { id: true, name: true } },
        variants: { orderBy: { position: 'asc' } },
        media: { orderBy: { position: 'asc' } },
        collectionLinks: { include: { collection: { select: { id: true, title: true } } } },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(storeId: string, dto: CreateProductDto) {
    await this.assertSeller(storeId, dto.sellerId);
    if (dto.categoryId) await this.assertCategory(storeId, dto.categoryId);
    if (dto.brandId) await this.assertBrand(storeId, dto.brandId);
    const slug = await this.uniqueSlug(storeId, dto.slug || dto.title);
    const created = await this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: { storeId, sellerId: dto.sellerId, slug, title: dto.title, ...this.scalars(dto) },
      });
      await this.writeVariants(tx, product.id, dto.variants ?? [], 'create');
      await this.writeMedia(tx, product.id, dto.media ?? []);
      await this.writeCollections(tx, storeId, product.id, dto.collectionIds ?? []);
      return product;
    });
    return this.get(storeId, created.id);
  }

  async update(storeId: string, id: string, dto: UpdateProductDto) {
    await this.own(storeId, id);
    if (dto.sellerId) await this.assertSeller(storeId, dto.sellerId);
    if (dto.categoryId) await this.assertCategory(storeId, dto.categoryId);
    if (dto.brandId) await this.assertBrand(storeId, dto.brandId);
    const slug = dto.slug ? await this.uniqueSlug(storeId, dto.slug, id) : undefined;
    const oldMin = dto.variants ? await this.minPrice(id) : null;
    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { ...this.scalars(dto), ...(dto.title !== undefined ? { title: dto.title } : {}), ...(dto.sellerId ? { sellerId: dto.sellerId } : {}), ...(slug ? { slug } : {}) },
      });
      if (dto.variants) await this.writeVariants(tx, id, dto.variants, 'upsert');
      if (dto.media) { await tx.productMedia.deleteMany({ where: { productId: id } }); await this.writeMedia(tx, id, dto.media); }
      if (dto.collectionIds) { await tx.collectionProduct.deleteMany({ where: { productId: id } }); await this.writeCollections(tx, storeId, id, dto.collectionIds); }
    });
    if (oldMin != null) {
      const newMin = await this.minPrice(id);
      if (newMin != null && newMin < oldMin) {
        const p = await this.prisma.product.findUnique({ where: { id }, select: { slug: true, title: true } });
        if (p) await this.engagement.notifyPriceDrop(storeId, { id, slug: p.slug, title: p.title }, oldMin, newMin);
      }
    }
    return this.get(storeId, id);
  }

  private async minPrice(productId: string): Promise<number | null> {
    const rows = await this.prisma.productVariant.findMany({ where: { productId }, select: { price: true } });
    if (!rows.length) return null;
    return Math.min(...rows.map((r) => Number(r.price)));
  }

  async remove(storeId: string, id: string) {
    await this.own(storeId, id);
    const ordered = await this.prisma.orderItem.count({ where: { productId: id } });
    if (ordered > 0) throw new BadRequestException('This product is part of existing orders and cannot be deleted. Set its status to Archived to hide it from your store while keeping order history intact.');
    await this.prisma.product.delete({ where: { id } });
    return { ok: true };
  }

  private scalars(dto: ProductBase) {
    return {
      categoryId: dto.categoryId ?? undefined,
      description: dto.description,
      brandId: dto.brandId ?? undefined,
      status: dto.status as ProductStatus | undefined,
      hsnCode: dto.hsnCode,
      gstRate: dto.gstRate,
      taxInclusive: dto.taxInclusive,
      discountable: dto.discountable,
      uom: dto.uom,
      variantAxes: json(dto.variantAxes),
      specifications: json(dto.specifications),
      tags: dto.tags,
      relatedProductIds: dto.relatedProductIds,
      isCustomizable: dto.isCustomizable,
      customizationFields: json(dto.customizationFields),
      metaTitle: dto.metaTitle,
      metaDescription: dto.metaDescription,
      returnable: dto.returnable,
      returnWindowDays: dto.returnWindowDays,
      minOrderQty: dto.minOrderQty,
      maxOrderQty: dto.maxOrderQty,
    };
  }

  private variantData(v: VariantDto, index: number) {
    return {
      attributes: json(v.attributes),
      price: v.price,
      mrp: v.mrp,
      costPrice: v.costPrice,
      stock: v.stock ?? 0,
      barcode: v.barcode,
      weightGrams: v.weightGrams,
      lengthCm: v.lengthCm,
      widthCm: v.widthCm,
      heightCm: v.heightCm,
      position: v.position ?? index,
      isActive: v.isActive ?? true,
    };
  }

  private async writeVariants(tx: Tx, productId: string, variants: VariantDto[], mode: 'create' | 'upsert') {
    if (mode === 'create') {
      await Promise.all(variants.map((v, i) => tx.productVariant.create({ data: { productId, sku: v.sku, ...this.variantData(v, i) } })));
      return;
    }
    const existing = await tx.productVariant.findMany({ where: { productId }, select: { id: true, sku: true } });
    const bySku = new Map(existing.map((v) => [v.sku, v.id]));
    const keep = new Set(variants.map((v) => v.sku));
    const remove = existing.filter((v) => !keep.has(v.sku)).map((v) => v.id);
    if (remove.length) await tx.productVariant.deleteMany({ where: { id: { in: remove } } });
    for (const [i, v] of variants.entries()) {
      const existId = bySku.get(v.sku);
      if (existId) await tx.productVariant.update({ where: { id: existId }, data: this.variantData(v, i) });
      else await tx.productVariant.create({ data: { productId, sku: v.sku, ...this.variantData(v, i) } });
    }
  }

  private async writeMedia(tx: Tx, productId: string, media: MediaDto[]) {
    if (!media.length) return;
    const variants = await tx.productVariant.findMany({ where: { productId }, select: { id: true, sku: true } });
    const skuToId = new Map(variants.map((v) => [v.sku, v.id]));
    await Promise.all(media.map((m, i) => tx.productMedia.create({
      data: {
        productId, url: m.url, thumbnailUrl: m.thumbnailUrl, alt: m.alt,
        type: (m.type as 'IMAGE' | 'VIDEO') ?? 'IMAGE',
        variantId: m.variantSku ? skuToId.get(m.variantSku) ?? null : null,
        colours: m.colours ?? [],
        position: m.position ?? i,
      },
    })));
  }

  private async writeCollections(tx: Tx, storeId: string, productId: string, collectionIds: string[]) {
    if (!collectionIds.length) return;
    const owned = await tx.collection.findMany({ where: { id: { in: collectionIds }, storeId }, select: { id: true } });
    await Promise.all(owned.map((c, i) => tx.collectionProduct.create({ data: { collectionId: c.id, productId, position: i } })));
  }

  private async assertSeller(storeId: string, sellerId: string) {
    const seller = await this.prisma.seller.findFirst({ where: { id: sellerId, storeId }, select: { id: true } });
    if (!seller) throw new BadRequestException('Seller not found in this store');
  }

  private async assertCategory(storeId: string, categoryId: string) {
    const cat = await this.prisma.category.findFirst({ where: { id: categoryId, storeId }, select: { id: true } });
    if (!cat) throw new BadRequestException('Category not found in this store');
  }

  private async assertBrand(storeId: string, brandId: string) {
    const brand = await this.prisma.brand.findFirst({ where: { id: brandId, storeId }, select: { id: true } });
    if (!brand) throw new BadRequestException('Brand not found in this store');
  }

  private async uniqueSlug(storeId: string, base: string, exceptId?: string) {
    const root = slugify(base) || 'product';
    let slug = root;
    let n = 2;
    while (await this.prisma.product.findFirst({ where: { storeId, slug, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { id: true } })) {
      slug = `${root}-${n++}`;
    }
    return slug;
  }

  private async own(storeId: string, id: string) {
    const p = await this.prisma.product.findFirst({ where: { id, storeId }, select: { id: true } });
    if (!p) throw new NotFoundException('Product not found');
    return p;
  }
}
