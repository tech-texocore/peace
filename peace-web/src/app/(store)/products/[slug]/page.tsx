import { notFound } from "next/navigation";
import { getStoreProduct, getStoreOffers } from "@/lib/storefront-server";
import { ProductDetailView } from "@/components/store/product-detail";

export const dynamic = "force-dynamic";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, offers] = await Promise.all([getStoreProduct(slug), getStoreOffers()]);
  if (!product) notFound();
  return <ProductDetailView product={product} offers={offers} />;
}
