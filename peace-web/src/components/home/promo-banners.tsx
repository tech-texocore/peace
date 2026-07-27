import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Section } from "@/components/layout/section";
import { Placeholder } from "@/components/ui/placeholder";
import { cn } from "@/lib/utils/cn";
import { gap, type as t } from "@/lib/tokens";
import type { SiteConfig } from "@/lib/site-config";

export function PromoBanners({ config }: { config: SiteConfig }) {
  const promos = config.promos ?? [];
  if (promos.length === 0) return null;

  return (
    <Section tight>
      <div className={cn("grid md:grid-cols-2", gap.grid)}>
        {promos.map((b) => (
          <Link key={b.title} href={b.href} className="group relative overflow-hidden rounded-3xl">
            {b.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.image} alt={b.title} className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105" />
            ) : (
              <Placeholder ratio="aspect-[16/10]" className="transition-transform duration-500 group-hover:scale-105" />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-ink/60 via-ink/20 to-transparent" />
            <div className="absolute inset-0 flex flex-col justify-center gap-3 p-8 text-canvas lg:p-12">
              <p className={cn("opacity-90", t.eyebrow, "text-canvas")}>{b.subtitle}</p>
              <h3 className="max-w-xs font-display text-3xl font-medium lg:text-4xl">{b.title}</h3>
              <span className={cn("mt-2 inline-flex items-center gap-2", t.label)}>
                {b.cta}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </Section>
  );
}
