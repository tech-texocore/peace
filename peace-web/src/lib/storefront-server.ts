import { env } from "@/lib/config/env";

const base = () => `${env.apiBaseUrl}/storefront/${env.storeSlug}`;

export interface ProductCard {
  id: string; slug: string; title: string; brand: string | null;
  image: string | null; hoverImage: string | null;
  priceFrom: number; mrp: number | null; discountPct: number; inStock: boolean; colours: string[];
  colourVariants: { colour: string; variantId: string; inStock: boolean; image: string | null }[];
  variantCount: number; defaultVariantId: string | null; uom: string;
  ratingAvg: number; ratingCount: number;
}
export interface SizeGuide { fields: { key: string; label: string; type: string; unit?: string }[]; items: { value: string; label: string; metadata: Record<string, unknown> | null }[] }
export interface Facet { value: string; count: number }
export interface ProductFacets { colours: Facet[]; sizes: Facet[]; fabrics: Facet[]; priceRange: { min: number; max: number } }
export interface StoreMeta { type: string; title: string; description: string | null; image: string | null }
export interface ProductList { items: ProductCard[]; total: number; page: number; limit: number; facets?: ProductFacets; meta?: StoreMeta | null }
export interface StoreCategory { id: string; name: string; slug: string; imageUrl: string | null; children: StoreCategory[] }

export interface ProductVariant {
  id: string; sku: string; attributes: Record<string, string> | null;
  price: string; mrp: string | null; stock: number;
}
export interface ProductDetail {
  id: string; slug: string; title: string; description: string | null;
  brand: { name: string; slug: string } | null;
  category: { name: string; slug: string } | null;
  seller: { name: string; returnable: boolean; returnWindowDays: number; codAvailable: boolean; warrantyInfo: string | null; dispatchDays: number };
  variants: ProductVariant[];
  media: { id: string; type: string; url: string; alt: string | null; variantId: string | null; colours: string[] }[];
  specifications: { key: string; label: string; value: string }[] | null;
  variantAxes: string[] | null;
  isCustomizable: boolean;
  customizationFields: { label: string; type: string; required?: boolean; options?: string[] }[] | null;
  uom: string; taxInclusive: boolean; priceFrom: number | null; inStock: boolean;
  sizeGuide: SizeGuide | null;
  related: ProductCard[];
  ratingAvg: number; ratingCount: number;
}

export interface ReviewSummary { average: number; count: number; breakdown: Record<string, number>; verifiedCount: number }
export interface Review {
  id: string; rating: number; title: string | null; comment: string | null; media: string[];
  isVerifiedPurchase: boolean; helpfulCount: number; createdAt: string; author: string; avatar: string | null;
}
export interface ReviewsResponse { summary: ReviewSummary; reviews: Review[] }
export interface QaAnswer { id: string; body: string; author: string; isSeller: boolean; createdAt: string }
export interface Question { id: string; body: string; author: string; createdAt: string; answers: QaAnswer[] }

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return fallback;
    const body = await res.json();
    return (body?.data ?? fallback) as T;
  } catch { return fallback; }
}

export function getStoreProducts(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
  return fetchJson<ProductList>(`${base()}/products?${qs}`, { items: [], total: 0, page: 1, limit: 24 });
}
export function getStoreProduct(slug: string) {
  return fetchJson<ProductDetail | null>(`${base()}/products/${slug}`, null);
}
export function getStoreCardsByIds(ids: string[]) {
  if (!ids.length) return Promise.resolve<ProductCard[]>([]);
  return fetchJson<ProductCard[]>(`${base()}/cards?ids=${ids.join(",")}`, []);
}
export function getStoreCategories() {
  return fetchJson<StoreCategory[]>(`${base()}/categories`, []);
}
export interface StoreOffer { code: string; label: string; note: string }
export function getStoreOffers() {
  return fetchJson<StoreOffer[]>(`${base()}/offers`, []);
}
export interface NewsletterOffer { offer: string; code: string | null; minSubtotal: number | null }
export function getStoreNewsletterOffer() {
  return fetchJson<NewsletterOffer | null>(`${base()}/newsletter-offer`, null);
}
export interface StoreTestimonial { quote: string; rating: number; name: string; location: string | null; verified: boolean }
export function getStoreTestimonials() {
  return fetchJson<StoreTestimonial[]>(`${base()}/testimonials`, []);
}
export interface DeliveryMethodInfo { key: string; label: string; fee: number; days: number }
export function getStoreShipping() {
  return fetchJson<{ freeShippingThreshold: number; codEnabled: boolean; methods: DeliveryMethodInfo[] }>(`${base()}/shipping-info`, { freeShippingThreshold: 0, codEnabled: true, methods: [] });
}
