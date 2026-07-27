import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infra/prisma/prisma.service';
import type { SearchProvider, Suggestion } from '../search-provider.interface';

// Postgres full-text search (tsvector) + pg_trgm similarity for typo tolerance.
// No external service — runs entirely inside the app's own database.
@Injectable()
export class PostgresSearchProvider implements SearchProvider {
  constructor(private readonly prisma: PrismaService) {}

  // Build a safe to_tsquery string: each term's words AND-ed, terms OR-ed.
  private tsQuery(terms: string[]): string {
    return terms
      .map((t) => t.toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z0-9]/g, '')).filter(Boolean).join(' & '))
      .filter(Boolean)
      .join(' | ');
  }

  async searchProductIds(storeId: string, terms: string[]): Promise<string[]> {
    const raw = (terms[0] ?? '').toLowerCase().trim();
    if (!raw) return [];
    const tsq = this.tsQuery(terms);
    const like = `%${raw}%`;
    const ftsMatch = tsq
      ? Prisma.sql`to_tsvector('simple', coalesce(p.title,'') || ' ' || coalesce(p.description,'') || ' ' || coalesce(array_to_string(p.tags, ' '), '')) @@ to_tsquery('simple', ${tsq})`
      : Prisma.sql`false`;
    const ftsRank = tsq
      ? Prisma.sql`ts_rank(to_tsvector('simple', coalesce(p.title,'') || ' ' || coalesce(p.description,'')), to_tsquery('simple', ${tsq}))`
      : Prisma.sql`0`;

    const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT p.id
      FROM "Product" p
      WHERE p."storeId" = ${storeId} AND p.status = 'ACTIVE'
        AND (
          ${ftsMatch}
          OR lower(p.title) LIKE ${like}
          OR similarity(lower(p.title), ${raw}) > 0.2
          OR word_similarity(${raw}, lower(p.title)) > 0.3
        )
      ORDER BY ${ftsRank} DESC, similarity(lower(p.title), ${raw}) DESC
      LIMIT 100
    `);
    return rows.map((r) => r.id);
  }

  async suggest(storeId: string, query: string): Promise<Suggestion> {
    const raw = query.toLowerCase().trim();
    if (!raw) return { products: [], categories: [], brands: [] };
    const prefix = `${raw}%`;
    const contains = `%${raw}%`;

    const [products, categories, brands] = await Promise.all([
      this.prisma.$queryRaw<{ slug: string; title: string; image: string | null }[]>(Prisma.sql`
        SELECT p.slug, p.title,
          (SELECT m.url FROM "ProductMedia" m WHERE m."productId" = p.id AND m.type = 'IMAGE' ORDER BY m.position ASC LIMIT 1) AS image
        FROM "Product" p
        WHERE p."storeId" = ${storeId} AND p.status = 'ACTIVE'
          AND (lower(p.title) LIKE ${contains} OR similarity(lower(p.title), ${raw}) > 0.2)
        ORDER BY (lower(p.title) LIKE ${prefix}) DESC, similarity(lower(p.title), ${raw}) DESC
        LIMIT 6
      `),
      this.prisma.category.findMany({ where: { storeId, isActive: true, name: { contains: query, mode: 'insensitive' } }, take: 4, select: { slug: true, name: true } }),
      this.prisma.brand.findMany({ where: { storeId, isActive: true, name: { contains: query, mode: 'insensitive' } }, take: 4, select: { slug: true, name: true } }),
    ]);
    return { products, categories, brands };
  }
}
