import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { MediaService } from '../../infra/media/media.service';

const COLUMNS = [
  'id',
  'item_group_id',
  'title',
  'description',
  'availability',
  'condition',
  'price',
  'sale_price',
  'link',
  'image_link',
  'additional_image_link',
  'brand',
  'color',
  'size',
  'google_product_category',
] as const;

const csv = (v: string) => {
  const s = v.replace(/\r?\n/g, ' ').trim();
  return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const money = (n: number) => `${n.toFixed(2)} INR`;
const plain = (html?: string | null) =>
  (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// One row per variant, grouped by product, so ids match the Pixel's content_ids.
@Injectable()
export class MetaCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly media: MediaService,
    private readonly config: ConfigService,
  ) {}

  async csv(): Promise<string> {
    const slug = this.config.get<string>('platform.defaultStoreSlug')!;
    const webUrl = (
      this.config.get<string[]>('app.corsOrigins')?.[0] ?? ''
    ).replace(/\/$/, '');
    const store = await this.prisma.store.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });
    if (!store) return COLUMNS.join(',') + '\n';

    const products = await this.prisma.product.findMany({
      where: { storeId: store.id, status: 'ACTIVE' },
      include: {
        brand: { select: { name: true } },
        media: { where: { type: 'IMAGE' }, orderBy: { position: 'asc' } },
        variants: { where: { isActive: true }, orderBy: { position: 'asc' } },
      },
    });

    const rows = [COLUMNS.join(',')];
    for (const p of products) {
      const images = p.media.map((m) => ({
        ...m,
        url: this.media.resolve(m.url),
      }));
      for (const v of p.variants) {
        const attrs = (v.attributes ?? {}) as Record<string, string>;
        const colour = attrs.colour ?? attrs.color ?? '';
        const own = images.filter(
          (m) => m.variantId === v.id || (colour && m.colours.includes(colour)),
        );
        const pics = (own.length ? own : images).map((m) => m.url);
        const price = Number(v.price);
        const mrp = v.mrp ? Number(v.mrp) : null;
        const onSale = mrp !== null && mrp > price;
        const name = [p.title, colour, attrs.size].filter(Boolean).join(' · ');
        rows.push(
          [
            v.id,
            p.id,
            name,
            plain(p.description) || p.title,
            v.stock > 0 ? 'in stock' : 'out of stock',
            'new',
            money(onSale ? mrp : price),
            onSale ? money(price) : '',
            `${webUrl}/products/${p.slug}`,
            pics[0] ?? '',
            pics.slice(1, 10).join(','),
            p.brand?.name ?? store.name,
            colour,
            attrs.size ?? '',
            'Apparel & Accessories > Clothing',
          ]
            .map(csv)
            .join(','),
        );
      }
    }
    return rows.join('\n') + '\n';
  }
}
