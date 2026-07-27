import { getStoreProducts, getStoreCategories } from "@/lib/storefront-server";
import { ProductListing } from "@/components/store/product-listing";

export const dynamic = "force-dynamic";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [list, categories] = await Promise.all([
    getStoreProducts({
      category: sp.category, collection: sp.collection, sort: sp.sort, search: sp.search, page: sp.page,
      sizes: sp.sizes, colours: sp.colours, fabrics: sp.fabrics,
      minPrice: sp.minPrice, maxPrice: sp.maxPrice, inStock: sp.inStock, discount: sp.discount,
    }),
    getStoreCategories(),
  ]);

  return (
    <ProductListing
      list={list}
      categories={categories}
      fallbackTitle={sp.search ? `Results for “${sp.search}”` : "Shop all"}
      fallbackSubtitle="Handpicked textiles, thoughtfully made."
    />
  );
}
