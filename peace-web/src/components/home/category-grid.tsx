import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Section } from "@/components/layout/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/utils/cn";
import { gap, radius } from "@/lib/tokens";
import type { SiteConfig } from "@/lib/site-config";
import type { StoreCategory } from "@/lib/storefront-server";

export function CategoryGrid({ config, categories }: { config: SiteConfig; categories: StoreCategory[] }) {
  const { sections } = config;
  const items = categories.slice(0, 5);
  if (items.length === 0) return null;

  return (
    <Section>
      <SectionHeading eyebrow={sections.categories.eyebrow} title={sections.categories.title} ctaLabel="All categories" ctaHref="/products" />

      <div className={cn("grid grid-cols-2 lg:h-[500px] lg:grid-cols-4 lg:grid-rows-2", gap.grid)}>
        {items.map((cat, i) => (
          <Link
            key={cat.id}
            href={`/products?category=${cat.slug}`}
            className={cn("group relative overflow-hidden bg-card", radius.card, i === 0 && "lg:col-span-2 lg:row-span-2")}
          >
            {cat.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cat.imageUrl} alt={cat.name} className="aspect-square h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 lg:aspect-auto" />
            ) : <div className="aspect-square h-full w-full bg-accent-soft lg:aspect-auto" />}
            <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-5">
              <div className="text-canvas">
                <h3 className="font-display text-xl lg:text-2xl">{cat.name}</h3>
                {cat.children.length > 0 && <p className="text-xs opacity-80">{cat.children.length} sub-categories</p>}
              </div>
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-canvas text-ink transition-transform group-hover:rotate-45">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}
