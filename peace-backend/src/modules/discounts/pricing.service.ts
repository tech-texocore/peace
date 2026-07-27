import { Injectable } from '@nestjs/common';
import { Discount } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

export interface QuoteItemInput { variantId: string; quantity: number }
export interface QuoteInput { items: QuoteItemInput[]; couponCodes?: string[]; customerGroupId?: string; userId?: string }

interface Line {
  variantId: string; productId: string; slug: string; title: string; image: string | null; uom: string;
  sku: string; attributes: Record<string, string> | null; mrp: number | null; stock: number;
  categoryPath: string | null; collectionIds: string[]; quantity: number; unitPrice: number; lineTotal: number; discountable: boolean;
}
interface Applied { id: string; name: string; code: string | null; type: string; amount: number; freeShipping: boolean }

const round = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async quote(storeId: string, input: QuoteInput) {
    const codes = (input.couponCodes ?? []).map((c) => c.trim().toUpperCase()).filter(Boolean);
    const lines = await this.buildLines(storeId, input.items);
    const subtotal = round(lines.reduce((s, l) => s + l.lineTotal, 0));
    const totalQty = lines.reduce((s, l) => s + l.quantity, 0);

    const now = new Date();
    const candidates = await this.prisma.discount.findMany({
      where: {
        storeId, isActive: true,
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }, { OR: [{ method: 'AUTOMATIC' }, { method: 'CODE', code: { in: codes } } as never] }],
      },
    });

    // Category-subtree matching needs target paths.
    const catIds = Array.from(new Set(candidates.flatMap((d) => d.targetCategoryIds)));
    const catPaths = catIds.length ? await this.prisma.category.findMany({ where: { id: { in: catIds }, storeId }, select: { id: true, path: true } }) : [];
    const pathById = new Map(catPaths.map((c) => [c.id, c.path ?? '']));

    const applied: Applied[] = [];
    const rejectedCoupons: { code: string; reason: string }[] = [];

    for (const d of candidates) {
      const reason = await this.disqualify(d, { subtotal, totalQty, customerGroupId: input.customerGroupId, userId: input.userId });
      if (reason) { if (d.method === 'CODE' && d.code) rejectedCoupons.push({ code: d.code, reason }); continue; }

      const eligible = this.eligibleLines(d, lines, pathById);
      const eligibleTotal = round(eligible.reduce((s, l) => s + l.lineTotal, 0));
      if (d.type !== 'FREE_SHIPPING' && eligibleTotal <= 0) {
        if (d.method === 'CODE' && d.code) rejectedCoupons.push({ code: d.code, reason: 'Not valid for the items in your cart' });
        continue;
      }
      const amt = this.amountFor(d, eligible, eligibleTotal);
      if (amt.amount > 0 || amt.freeShipping) applied.push(amt);
      else if (d.method === 'CODE' && d.code) rejectedCoupons.push({ code: d.code, reason: 'Not valid for the items in your cart' });
    }

    // Free shipping applies independently. Amount discounts follow stacking rules:
    // all stackable apply; among non-stackable, only the single best.
    const freeShip = applied.filter((a) => a.freeShipping);
    const amountDiscounts = applied.filter((a) => !a.freeShipping);
    const stackable = amountDiscounts.filter((a) => candidates.find((d) => d.id === a.id)!.stackable);
    const nonStackable = amountDiscounts.filter((a) => !candidates.find((d) => d.id === a.id)!.stackable)
      .sort((a, b) => b.amount - a.amount);
    const finalApplied = [...stackable, ...(nonStackable[0] ? [nonStackable[0]] : []), ...freeShip];

    let totalDiscount = round(finalApplied.reduce((s, a) => s + a.amount, 0));
    if (totalDiscount > subtotal) totalDiscount = subtotal;
    const freeShipping = freeShip.length > 0;

    return {
      lines: lines.map((l) => ({ variantId: l.variantId, productId: l.productId, slug: l.slug, title: l.title, image: l.image, uom: l.uom, sku: l.sku, attributes: l.attributes, unitPrice: l.unitPrice, mrp: l.mrp, quantity: l.quantity, lineTotal: l.lineTotal, stock: l.stock, outOfStock: l.stock <= 0, exceedsStock: l.quantity > l.stock })),
      subtotal,
      appliedDiscounts: finalApplied.map((a) => ({ id: a.id, name: a.name, code: a.code, type: a.type, amount: a.amount, freeShipping: a.freeShipping })),
      totalDiscount,
      freeShipping,
      total: round(subtotal - totalDiscount),
      rejectedCoupons,
    };
  }

  private async buildLines(storeId: string, items: QuoteItemInput[]): Promise<Line[]> {
    const ids = items.map((i) => i.variantId);
    if (!ids.length) return [];
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: ids }, product: { storeId } },
      include: { product: { select: { id: true, title: true, slug: true, uom: true, discountable: true, media: { where: { type: 'IMAGE' }, orderBy: { position: 'asc' }, take: 1 }, category: { select: { path: true } }, collectionLinks: { select: { collectionId: true } } } } },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));
    const lines: Line[] = [];
    for (const it of items) {
      const v = byId.get(it.variantId);
      if (!v || it.quantity <= 0) continue;
      const unitPrice = Number(v.price);
      lines.push({
        variantId: v.id, productId: v.product.id, slug: v.product.slug, title: v.product.title, uom: v.product.uom,
        image: v.product.media[0]?.url ?? null, sku: v.sku, attributes: (v.attributes as Record<string, string> | null) ?? null,
        mrp: v.mrp != null ? Number(v.mrp) : null, stock: v.stock,
        categoryPath: v.product.category?.path ?? null,
        collectionIds: v.product.collectionLinks.map((c) => c.collectionId), quantity: it.quantity,
        unitPrice, lineTotal: round(unitPrice * it.quantity), discountable: v.product.discountable,
      });
    }
    return lines;
  }

  private async disqualify(d: Discount, ctx: { subtotal: number; totalQty: number; customerGroupId?: string; userId?: string }): Promise<string | null> {
    if (d.customerGroupIds.length && (!ctx.customerGroupId || !d.customerGroupIds.includes(ctx.customerGroupId))) return 'Not available for your account';
    if (d.minSubtotal != null && ctx.subtotal < Number(d.minSubtotal)) return `Minimum spend ₹${Number(d.minSubtotal)} required`;
    if (d.minQuantity != null && ctx.totalQty < d.minQuantity) return `Add at least ${d.minQuantity} items`;
    if (d.usageLimit != null && d.usedCount >= d.usageLimit) return 'This code has reached its usage limit';
    if (d.perCustomerLimit != null && ctx.userId) {
      const used = await this.prisma.discountUsage.count({ where: { discountId: d.id, userId: ctx.userId } });
      if (used >= d.perCustomerLimit) return 'You have already used this code';
    }
    return null;
  }

  private eligibleLines(d: Discount, lines: Line[], pathById: Map<string, string>): Line[] {
    const usable = lines.filter((l) => l.discountable);
    if (d.scope === 'ALL') return usable;
    if (d.scope === 'PRODUCTS') return usable.filter((l) => d.targetProductIds.includes(l.productId));
    if (d.scope === 'COLLECTIONS') return usable.filter((l) => l.collectionIds.some((c) => d.targetCollectionIds.includes(c)));
    if (d.scope === 'CATEGORIES') {
      const paths = d.targetCategoryIds.map((id) => pathById.get(id)).filter(Boolean) as string[];
      return usable.filter((l) => l.categoryPath && paths.some((p) => l.categoryPath === p || l.categoryPath!.startsWith(`${p}/`)));
    }
    return [];
  }

  private amountFor(d: Discount, eligible: Line[], eligibleTotal: number): Applied {
    const base = { id: d.id, name: d.name, code: d.code, type: d.type };
    if (d.type === 'FREE_SHIPPING') return { ...base, amount: 0, freeShipping: true };
    if (d.type === 'PERCENTAGE') return { ...base, amount: round(eligibleTotal * Number(d.value) / 100), freeShipping: false };
    if (d.type === 'FIXED_AMOUNT') return { ...base, amount: round(Math.min(Number(d.value), eligibleTotal)), freeShipping: false };
    if (d.type === 'BUY_X_GET_Y') return { ...base, amount: this.bogo(d, eligible), freeShipping: false };
    return { ...base, amount: 0, freeShipping: false };
  }

  private bogo(d: Discount, eligible: Line[]): number {
    const buy = d.buyQuantity ?? 1, get = d.getQuantity ?? 1, pct = (d.getDiscountPercent ?? 100) / 100;
    const units: number[] = [];
    eligible.forEach((l) => { for (let i = 0; i < l.quantity; i++) units.push(l.unitPrice); });
    units.sort((a, b) => a - b); // discount the cheapest
    const groups = Math.floor(units.length / (buy + get));
    const freeCount = groups * get;
    let amount = 0;
    for (let i = 0; i < freeCount; i++) amount += units[i] * pct;
    return round(amount);
  }
}
