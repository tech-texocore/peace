import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { PricingService, type QuoteInput } from '../discounts/pricing.service';
import { ReviewsService } from '../reviews/reviews.service';
import { SearchService } from '../search/search.service';
import { resolveShipping } from '../orders/checkout.config';

interface ProductQuery {
  category?: string; collection?: string; search?: string; sort?: string; page?: number; limit?: number;
  sizes?: string[]; colours?: string[]; fabrics?: string[]; minPrice?: number; maxPrice?: number; inStock?: boolean; discount?: boolean;
}

@Injectable()
export class StorefrontService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly reviews: ReviewsService,
    private readonly search: SearchService,
  ) {}

  async suggest(slug: string, query: string) {
    const storeId = await this.storeId(slug);
    return this.search.suggest(storeId, query);
  }

  async quote(slug: string, input: QuoteInput) {
    const storeId = await this.storeId(slug);
    return this.pricing.quote(storeId, input);
  }

  private async storeId(slug: string) {
    const store = await this.prisma.store.findUnique({ where: { slug }, select: { id: true } });
    if (!store) throw new NotFoundException('Store not found');
    return store.id;
  }

  async shippingInfo(slug: string) {
    const storeId = await this.storeId(slug);
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { settings: true } });
    const s = resolveShipping(store?.settings);
    return { freeShippingThreshold: s.freeShippingThreshold, codEnabled: s.codEnabled, methods: s.methods };
  }

  async offers(slug: string) {
    const storeId = await this.storeId(slug);
    const now = new Date();
    const rows = await this.prisma.discount.findMany({
      where: {
        storeId, method: 'CODE', isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 12,
      select: { code: true, name: true, type: true, value: true, minSubtotal: true, endsAt: true },
    });
    return rows.map((d) => ({
      code: d.code,
      label: d.name,
      note: d.minSubtotal ? `Min. spend ₹${Number(d.minSubtotal).toLocaleString('en-IN')}` : this.offerNote(d),
    }));
  }

  async testimonials(slug: string, limit = 6) {
    const storeId = await this.storeId(slug);
    const rows = await this.prisma.review.findMany({
      where: { storeId, status: 'APPROVED', rating: { gte: 4 }, comment: { not: null } },
      orderBy: [{ rating: 'desc' }, { isVerifiedPurchase: 'desc' }, { helpfulCount: 'desc' }, { createdAt: 'desc' }],
      take: limit * 6,
      select: {
        userId: true, rating: true, comment: true, isVerifiedPurchase: true,
        user: { select: { name: true, addresses: { orderBy: { isDefault: 'desc' }, take: 1, select: { city: true, state: true } } } },
      },
    });
    const seenUsers = new Set<string>();
    const seenQuotes = new Set<string>();
    const out: { quote: string; rating: number; name: string; location: string | null; verified: boolean }[] = [];
    for (const r of rows) {
      const quote = (r.comment ?? '').trim();
      if (!quote || seenUsers.has(r.userId) || seenQuotes.has(quote)) continue;
      seenUsers.add(r.userId);
      seenQuotes.add(quote);
      const addr = r.user.addresses[0];
      out.push({
        quote,
        rating: r.rating,
        name: this.displayName(r.user.name),
        location: addr ? [addr.city, addr.state].filter(Boolean).join(', ') : null,
        verified: r.isVerifiedPurchase,
      });
      if (out.length >= limit) break;
    }
    return out;
  }

  private displayName(name: string | null): string {
    const trimmed = (name ?? '').trim();
    if (!trimmed) return 'Verified buyer';
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
  }

  async newsletterOffer(slug: string) {
    const storeId = await this.storeId(slug);
    const now = new Date();
    const d = await this.prisma.discount.findFirst({
      where: {
        storeId, featuredInNewsletter: true, isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      select: { code: true, type: true, value: true, minSubtotal: true },
    });
    if (!d) return null;
    const offer =
      d.type === 'PERCENTAGE' ? `${Number(d.value)}%`
      : d.type === 'FIXED_AMOUNT' ? `₹${Number(d.value).toLocaleString('en-IN')}`
      : d.type === 'FREE_SHIPPING' ? 'free shipping'
      : 'a special offer';
    return { offer, code: d.code ?? null, minSubtotal: d.minSubtotal ? Number(d.minSubtotal) : null };
  }

  async subscribe(slug: string, rawEmail: string, source = 'newsletter') {
    const email = (rawEmail ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Please enter a valid email address.');
    const storeId = await this.storeId(slug);
    const user = await this.prisma.user.findFirst({ where: { email, role: 'CUSTOMER' }, select: { id: true } });
    await this.prisma.newsletterSubscriber.upsert({
      where: { storeId_email: { storeId, email } },
      update: { status: 'SUBSCRIBED', userId: user?.id ?? undefined },
      create: { storeId, email, source, userId: user?.id ?? null },
    });
    return { ok: true };
  }

  private offerNote(d: { type: string; value: unknown; endsAt: Date | null }) {
    if (d.endsAt) return `Valid till ${new Date(d.endsAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}`;
    if (d.type === 'FREE_SHIPPING') return 'Free shipping';
    return 'No minimum spend';
  }

  async categories(slug: string) {
    const storeId = await this.storeId(slug);
    const all = await this.prisma.category.findMany({
      where: { storeId, isActive: true },
      orderBy: [{ position: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, slug: true, parentId: true, imageUrl: true },
    });
    const nest = (parentId: string | null): unknown[] =>
      all.filter((c) => c.parentId === parentId).map((c) => ({ ...c, children: nest(c.id) }));
    return nest(null);
  }

  async products(slug: string, query: ProductQuery) {
    const storeId = await this.storeId(slug);
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(60, query.limit ?? 24);

    const where: Prisma.ProductWhereInput = { storeId, status: 'ACTIVE' };
    if (query.category) {
      const cat = await this.prisma.category.findFirst({ where: { storeId, slug: query.category }, select: { path: true } });
      if (cat?.path) where.category = { path: { startsWith: cat.path } };
    }
    if (query.collection) where.collectionLinks = { some: { collection: { slug: query.collection } } };

    let searchRank: Map<string, number> | null = null;
    if (query.search) {
      const ids = await this.search.searchProductIds(storeId, query.search);
      if (!ids.length) return { items: [], total: 0, page, limit, facets: { colours: [], sizes: [], fabrics: [], priceRange: { min: 0, max: 0 } }, meta: null };
      where.id = { in: ids };
      searchRank = new Map(ids.map((id, i) => [id, i]));
    }

    const rows = await this.prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        brand: { select: { name: true, slug: true } },
        media: { where: { type: 'IMAGE' }, orderBy: { position: 'asc' }, select: { url: true, variantId: true, colours: true } },
        variants: { orderBy: { price: 'asc' }, select: { id: true, price: true, mrp: true, stock: true, attributes: true } },
      },
    });

    const enriched = rows.map((p) => {
      const card = this.card(p);
      const sizes = Array.from(new Set(p.variants.map((v) => (v.attributes as Record<string, string> | null)?.size).filter((sz): sz is string => Boolean(sz))));
      const specs = (p.specifications as { key: string; value: string }[] | null) ?? [];
      const fabric = specs.find((s) => s.key === 'fabric')?.value ?? null;
      return { card, sizes, colours: card.colours, fabric };
    });

    const facetOf = (get: (e: (typeof enriched)[number]) => string[]) => {
      const m = new Map<string, number>();
      enriched.forEach((e) => get(e).forEach((v) => m.set(v, (m.get(v) ?? 0) + 1)));
      return Array.from(m, ([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value));
    };
    const allPrices = enriched.map((e) => e.card.priceFrom);
    const facets = {
      colours: facetOf((e) => e.colours),
      sizes: facetOf((e) => e.sizes),
      fabrics: facetOf((e) => (e.fabric ? [e.fabric] : [])),
      priceRange: { min: allPrices.length ? Math.min(...allPrices) : 0, max: allPrices.length ? Math.max(...allPrices) : 0 },
    };

    let filtered = enriched.filter((e) => {
      if (query.colours?.length && !e.colours.some((c) => query.colours!.includes(c))) return false;
      if (query.sizes?.length && !e.sizes.some((s) => query.sizes!.includes(s))) return false;
      if (query.fabrics?.length && (!e.fabric || !query.fabrics.includes(e.fabric))) return false;
      if (query.minPrice != null && e.card.priceFrom < query.minPrice) return false;
      if (query.maxPrice != null && e.card.priceFrom > query.maxPrice) return false;
      if (query.inStock && !e.card.inStock) return false;
      if (query.discount && e.card.discountPct <= 0) return false;
      return true;
    });

    if (query.sort === 'price_asc') filtered = filtered.sort((a, b) => a.card.priceFrom - b.card.priceFrom);
    else if (query.sort === 'price_desc') filtered = filtered.sort((a, b) => b.card.priceFrom - a.card.priceFrom);
    else if (query.sort === 'discount') filtered = filtered.sort((a, b) => b.card.discountPct - a.card.discountPct);
    else if (searchRank) filtered = filtered.sort((a, b) => (searchRank!.get(a.card.id) ?? 99) - (searchRank!.get(b.card.id) ?? 99));

    filtered = [...filtered.filter((e) => e.card.inStock), ...filtered.filter((e) => !e.card.inStock)];

    const total = filtered.length;
    const pageCards = filtered.slice((page - 1) * limit, (page - 1) * limit + limit).map((e) => e.card);
    const ratings = await this.reviews.ratingsFor(pageCards.map((c) => c.id));
    const items = pageCards.map((c) => ({ ...c, ratingAvg: ratings.get(c.id)?.average ?? 0, ratingCount: ratings.get(c.id)?.count ?? 0 }));

    let meta: { type: string; title: string; description: string | null; image: string | null } | null = null;
    if (query.category) {
      const c = await this.prisma.category.findFirst({ where: { storeId, slug: query.category }, select: { name: true, description: true, imageUrl: true } });
      if (c) meta = { type: 'category', title: c.name, description: c.description, image: c.imageUrl };
    } else if (query.collection) {
      const c = await this.prisma.collection.findFirst({ where: { storeId, slug: query.collection }, select: { title: true, description: true, imageUrl: true } });
      if (c) meta = { type: 'collection', title: c.title, description: c.description, image: c.imageUrl };
    }

    return { items, total, page, limit, facets, meta };
  }

  async product(slug: string, productSlug: string) {
    const storeId = await this.storeId(slug);
    const p = await this.prisma.product.findFirst({
      where: { storeId, slug: productSlug, status: 'ACTIVE' },
      include: {
        brand: { select: { name: true, slug: true } },
        category: { select: { name: true, slug: true } },
        seller: { select: { name: true, returnable: true, returnWindowDays: true, codAvailable: true, warrantyInfo: true, dispatchDays: true } },
        variants: { orderBy: { position: 'asc' } },
        media: { orderBy: { position: 'asc' } },
      },
    });
    if (!p) throw new NotFoundException('Product not found');
    const prices = p.variants.map((v) => Number(v.price));

    let sizeGuide: { fields: unknown; items: { value: string; label: string; metadata: unknown }[] } | null = null;
    const axes = (p.variantAxes as string[] | null) ?? [];
    if (axes.includes('size')) {
      const master = await this.prisma.masterList.findFirst({
        where: { storeId, key: 'size' },
        include: { items: { where: { isActive: true }, orderBy: [{ position: 'asc' }] } },
      });
      if (master && (master.fields as unknown[] | null)?.length) {
        sizeGuide = { fields: master.fields, items: master.items.map((i) => ({ value: i.value, label: i.label, metadata: i.metadata })) };
      }
    }
    const relatedIds = (p.relatedProductIds as string[] | null) ?? [];
    const related = relatedIds.length
      ? await this.cardList(storeId, { id: { in: relatedIds } })
      : p.categoryId ? await this.cardList(storeId, { categoryId: p.categoryId, id: { not: p.id } }, 8) : [];

    const rating = await this.reviews.summary(p.id);
    // Product-level return policy overrides the seller default for what the PDP shows.
    const seller = p.seller
      ? { ...p.seller, returnable: p.returnable ?? p.seller.returnable, returnWindowDays: p.returnWindowDays ?? p.seller.returnWindowDays }
      : p.seller;
    return { ...p, seller, priceFrom: prices.length ? Math.min(...prices) : null, inStock: p.variants.some((v) => v.stock > 0), sizeGuide, related, ratingAvg: rating.average, ratingCount: rating.count };
  }

  // Cards for a specific set of product ids (wishlist etc.) — order preserved,
  // out-of-stock kept so the shopper still sees saved items.
  async cardsByIds(slug: string, ids: string[]) {
    if (!ids.length) return [];
    const storeId = await this.storeId(slug);
    const rows = await this.prisma.product.findMany({
      where: { storeId, status: 'ACTIVE', id: { in: ids } },
      include: {
        brand: { select: { name: true, slug: true } },
        media: { where: { type: 'IMAGE' }, orderBy: { position: 'asc' }, select: { url: true, variantId: true, colours: true } },
        variants: { orderBy: { price: 'asc' }, select: { id: true, price: true, mrp: true, stock: true, attributes: true } },
      },
    });
    const ratings = await this.reviews.ratingsFor(rows.map((r) => r.id));
    const byId = new Map(rows.map((r) => [r.id, { ...this.card(r), ratingAvg: ratings.get(r.id)?.average ?? 0, ratingCount: ratings.get(r.id)?.count ?? 0 }]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }

  private async cardList(storeId: string, where: Prisma.ProductWhereInput, take = 8) {
    const rows = await this.prisma.product.findMany({
      where: { storeId, status: 'ACTIVE', ...where },
      take: take * 2, orderBy: { createdAt: 'desc' },
      include: {
        brand: { select: { name: true, slug: true } },
        media: { where: { type: 'IMAGE' }, orderBy: { position: 'asc' }, select: { url: true, variantId: true, colours: true } },
        variants: { orderBy: { price: 'asc' }, select: { id: true, price: true, mrp: true, stock: true, attributes: true } },
      },
    });
    const cards = rows.map((r) => this.card(r)).filter((c) => c.inStock).slice(0, take);
    const ratings = await this.reviews.ratingsFor(cards.map((c) => c.id));
    return cards.map((c) => ({ ...c, ratingAvg: ratings.get(c.id)?.average ?? 0, ratingCount: ratings.get(c.id)?.count ?? 0 }));
  }

  private card(p: {
    id: string; slug: string; title: string; uom: string;
    brand: { name: string } | null;
    media: { url: string; variantId?: string | null }[];
    variants: { id: string; price: Prisma.Decimal; mrp: Prisma.Decimal | null; stock: number; attributes: Prisma.JsonValue }[];
  }) {
    const prices = p.variants.map((v) => Number(v.price));
    const priceFrom = prices.length ? Math.min(...prices) : 0;
    const cheapest = p.variants.find((v) => Number(v.price) === priceFrom) ?? p.variants[0];
    const mrp = cheapest?.mrp ? Number(cheapest.mrp) : null;
    const colourOf = (v: { attributes: Prisma.JsonValue }) => (v.attributes as Record<string, string> | null)?.colour;
    const colours = Array.from(new Set(p.variants.map(colourOf).filter((c): c is string => Boolean(c))));
    const inStockVariant = p.variants.find((v) => v.stock > 0) ?? cheapest;
    const colourById = new Map(p.variants.map((v) => [v.id, colourOf(v)]));
    const mediaMatchesColour = (m: { variantId?: string | null; colours?: string[] }, c: string) =>
      (m.colours?.includes(c) ?? false) || (m.variantId ? colourById.get(m.variantId) === c : false);
    const defaultImage = p.media[0]?.url ?? null;
    const colourVariants = colours.map((c) => {
      const vs = p.variants.filter((v) => colourOf(v) === c);
      const v = vs.find((x) => x.stock > 0) ?? vs[0];
      return { colour: c, variantId: v.id, inStock: vs.some((x) => x.stock > 0), image: p.media.find((m) => mediaMatchesColour(m, c))?.url ?? defaultImage };
    });
    return {
      id: p.id, slug: p.slug, title: p.title, brand: p.brand?.name ?? null,
      image: defaultImage, hoverImage: p.media[1]?.url ?? null,
      priceFrom, mrp, discountPct: mrp && mrp > priceFrom ? Math.round(((mrp - priceFrom) / mrp) * 100) : 0,
      inStock: p.variants.some((v) => v.stock > 0), colours, colourVariants, uom: p.uom,
      variantCount: p.variants.length, defaultVariantId: inStockVariant?.id ?? null,
    };
  }
}
