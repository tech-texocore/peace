import { Section } from "@/components/layout/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { ProductCard } from "@/components/store/product-card";
import { cn } from "@/lib/utils/cn";
import { gap } from "@/lib/tokens";
import type { ProductCard as ProductCardData } from "@/lib/storefront-server";

interface ProductRailProps {
  eyebrow?: string;
  title: string;
  description?: string;
  ctaHref?: string;
  items: ProductCardData[];
}

export function ProductRail({ eyebrow = "Curated", title, description, ctaHref = "/products", items }: ProductRailProps) {
  if (!items?.length) return null;
  return (
    <Section>
      <SectionHeading eyebrow={eyebrow} title={title} description={description} ctaLabel="View all" ctaHref={ctaHref} />
      <div className={cn("grid grid-cols-2 lg:grid-cols-4", gap.gridProducts)}>
        {items.slice(0, 8).map((p) => <ProductCard key={p.id} p={p} />)}
      </div>
    </Section>
  );
}
