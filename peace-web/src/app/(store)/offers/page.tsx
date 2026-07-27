import { Tag } from "lucide-react";
import { getStoreProducts, getStoreCategories, getStoreOffers } from "@/lib/storefront-server";
import { ProductListing } from "@/components/store/product-listing";

export const dynamic = "force-dynamic";

export default async function OffersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [list, categories, offers] = await Promise.all([
    getStoreProducts({
      discount: "true", sort: sp.sort ?? "discount", page: sp.page,
      sizes: sp.sizes, colours: sp.colours, fabrics: sp.fabrics, minPrice: sp.minPrice, maxPrice: sp.maxPrice,
    }),
    getStoreCategories(),
    getStoreOffers(),
  ]);

  return (
    <>
      {offers.length > 0 && (
        <div className="mx-auto max-w-[1800px] px-4 pt-6 sm:px-5 lg:px-6">
          <div className="rounded-2xl border border-line p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Tag className="h-4 w-4 text-accent" /> Coupons for you</p>
            <div className="flex flex-wrap gap-2">
              {offers.map((o) => (
                <span key={o.code} className="inline-flex items-center gap-2 rounded-lg border border-dashed border-accent px-3 py-1.5 text-sm">
                  <span className="font-semibold text-accent">{o.code}</span>
                  <span className="text-muted">{o.label} · {o.note}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      <ProductListing list={list} categories={categories} fallbackTitle="Offers & deals" fallbackSubtitle="Best prices on discounted styles." />
    </>
  );
}
