import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { SEARCH_PROVIDER, type SearchProvider } from './search-provider.interface';

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(SEARCH_PROVIDER) private readonly provider: SearchProvider,
  ) {}

  // Synonym groups are config-driven per store: store.settings.searchSynonyms = [["saree","sari"], ...].
  private async synonymGroups(storeId: string): Promise<string[][]> {
    const store = await this.prisma.store.findUnique({ where: { id: storeId }, select: { settings: true } });
    const groups = (store?.settings as Record<string, unknown> | null)?.searchSynonyms;
    return Array.isArray(groups) ? (groups.filter((g) => Array.isArray(g)) as string[][]) : [];
  }

  private expand(query: string, groups: string[][]): string[] {
    const q = query.toLowerCase().trim();
    const terms = new Set<string>([query]);
    for (const group of groups) {
      const lower = group.map((t) => String(t).toLowerCase());
      if (lower.some((t) => t === q || q.includes(t) || t.includes(q))) group.forEach((t) => terms.add(String(t)));
    }
    return [...terms];
  }

  async searchProductIds(storeId: string, query: string): Promise<string[]> {
    if (!query.trim()) return [];
    const groups = await this.synonymGroups(storeId);
    return this.provider.searchProductIds(storeId, this.expand(query, groups));
  }

  async suggest(storeId: string, query: string) {
    return this.provider.suggest(storeId, query.trim());
  }
}
