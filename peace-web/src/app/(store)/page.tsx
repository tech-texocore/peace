import { Hero } from "@/components/home/hero";
import { Marquee } from "@/components/home/marquee";
import { ValueProps } from "@/components/home/value-props";
import { CategoryGrid } from "@/components/home/category-grid";
import { ProductRail } from "@/components/home/product-rail";
import { PromoBanners } from "@/components/home/promo-banners";
import { OffersStrip } from "@/components/home/offers-strip";
import { Testimonials } from "@/components/home/testimonials";
import { Newsletter } from "@/components/home/newsletter";
import { getSiteConfig } from "@/lib/site-config-server";
import { getStoreCategories, getStoreProducts, getStoreProduct, getStoreOffers, getStoreNewsletterOffer, getStoreTestimonials } from "@/lib/storefront-server";

export const dynamic = "force-dynamic";

export default async function Home() {
  const config = await getSiteConfig();
  const featuredSlug = config.hero?.featuredProductSlug;
  const [categories, bestSellers, newArrivals, featured, offers, newsletterOffer, testimonials] = await Promise.all([
    getStoreCategories(),
    getStoreProducts({ collection: "best-sellers", limit: "8" }),
    getStoreProducts({ limit: "8" }),
    featuredSlug ? getStoreProduct(featuredSlug) : Promise.resolve(null),
    getStoreOffers(),
    getStoreNewsletterOffer(),
    getStoreTestimonials(),
  ]);
  const featuredProduct = featured
    ? { slug: featured.slug, title: featured.title, image: featured.media.find((m) => m.type === "IMAGE")?.url ?? null, priceFrom: featured.priceFrom ?? 0 }
    : null;
  const { sections } = config;
  const show = (key: string) => config.visibility?.[key] !== false;

  return (
    <>
      {show("hero") && <Hero config={config} featuredProduct={featuredProduct} />}
      {show("marquee") && <Marquee config={config} />}
      {show("valueProps") && <ValueProps config={config} />}
      {show("categories") && <CategoryGrid config={config} categories={categories} />}
      {show("bestSellers") && (
        <ProductRail
          eyebrow={sections.bestSellers.eyebrow}
          title={sections.bestSellers.title}
          description={sections.bestSellers.description}
          items={bestSellers.items}
          ctaHref="/products?collection=best-sellers"
        />
      )}
      {show("promos") && <PromoBanners config={config} />}
      {show("newArrivals") && (
        <ProductRail
          eyebrow={sections.newArrivals.eyebrow}
          title={sections.newArrivals.title}
          description={sections.newArrivals.description}
          items={newArrivals.items}
        />
      )}
      {show("offers") && <OffersStrip config={config} offers={offers} />}
      {show("testimonials") && testimonials.length > 0 && <Testimonials config={config} items={testimonials} />}
      {show("newsletter") && <Newsletter config={config} offer={newsletterOffer} />}
    </>
  );
}
