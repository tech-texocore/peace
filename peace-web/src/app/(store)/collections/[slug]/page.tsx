import { getStoreProducts, getStoreCategories } from "@/lib/storefront-server";
import { ProductListing } from "@/components/store/product-listing";

export const dynamic = "force-dynamic";

export default async function CollectionPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const filters = {
    sort: sp.sort, page: sp.page, sizes: sp.sizes, colours: sp.colours,
    fabrics: sp.fabrics, minPrice: sp.minPrice, maxPrice: sp.maxPrice, discount: sp.discount,
  };

  const [categories, asCollection] = await Promise.all([
    getStoreCategories(),
    getStoreProducts({ collection: slug, ...filters }),
  ]);

  let list = asCollection;
  if (!asCollection.meta) {
    const asCategory = await getStoreProducts({ category: slug, ...filters });
    if (asCategory.meta || asCategory.items.length) list = asCategory;
  }

  const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return <ProductListing list={list} categories={categories} fallbackTitle={title} />;
}
