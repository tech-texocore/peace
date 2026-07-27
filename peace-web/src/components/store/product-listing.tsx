import { ProductCard } from "@/components/store/product-card";
import { PlpControls } from "@/components/store/plp-controls";
import { FilterSidebar } from "@/components/store/filter-sidebar";
import { MobileFilters } from "@/components/store/mobile-filters";
import type { ProductList, StoreCategory } from "@/lib/storefront-server";

export function ProductListing({ list, categories, fallbackTitle, fallbackSubtitle }: {
  list: ProductList;
  categories: StoreCategory[];
  fallbackTitle: string;
  fallbackSubtitle?: string;
}) {
  const meta = list.meta;
  return (
    <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-5 lg:px-6">
      <header className="mb-6">
        {meta ? (
          <div className="overflow-hidden rounded-2xl border border-line">
            {meta.image && <img src={meta.image} alt={meta.title} className="h-40 w-full object-cover md:h-52" />}
            <div className="p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-accent">{meta.type}</p>
              <h1 className="mt-1 font-display text-3xl font-medium">{meta.title}</h1>
              {meta.description && <p className="mt-1 max-w-2xl text-sm text-muted">{meta.description}</p>}
            </div>
          </div>
        ) : (
          <>
            <h1 className="font-display text-3xl font-medium">{fallbackTitle}</h1>
            {fallbackSubtitle && <p className="mt-1 text-sm text-muted">{fallbackSubtitle}</p>}
          </>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <div className="hidden lg:block">
          {list.facets && <FilterSidebar facets={list.facets} />}
        </div>

        <div>
          <div className="mb-6 flex items-start gap-3">
            {list.facets && <MobileFilters facets={list.facets} />}
            <div className="flex-1">
              <PlpControls categories={categories} total={list.total} />
            </div>
          </div>

          {list.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line py-20 text-center text-sm text-muted">No products found.</div>
          ) : (
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {list.items.map((p) => <ProductCard key={p.id} p={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
