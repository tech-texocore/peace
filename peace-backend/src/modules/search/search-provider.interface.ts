export const SEARCH_PROVIDER = Symbol('SEARCH_PROVIDER');

export interface Suggestion {
  products: { slug: string; title: string; image: string | null }[];
  categories: { slug: string; name: string }[];
  brands: { slug: string; name: string }[];
}

/**
 * Pluggable product search. The default Postgres provider needs no external
 * service; a self-hosted engine (Meilisearch/Typesense) can implement this
 * same contract later without touching callers.
 */
export interface SearchProvider {
  /** Ranked, typo-tolerant product IDs. `terms` = raw query + synonym expansions. */
  searchProductIds(storeId: string, terms: string[]): Promise<string[]>;
  /** Autocomplete suggestions across products, categories and brands. */
  suggest(storeId: string, query: string): Promise<Suggestion>;
}
