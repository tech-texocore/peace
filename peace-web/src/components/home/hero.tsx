import Link from "next/link";
import { Star } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";
import { Placeholder } from "@/components/ui/placeholder";
import type { SiteConfig } from "@/lib/site-config";

export interface HeroProduct { slug: string; title: string; image: string | null; priceFrom: number }

export function Hero({ config, featuredProduct }: { config: SiteConfig; featuredProduct?: HeroProduct | null }) {
  const { hero } = config;
  const fp = featuredProduct;

  return (
    <section className="relative overflow-hidden">
      <Container className="grid items-center gap-8 py-8 lg:grid-cols-12 lg:gap-12 lg:py-12">
        <div className="lg:col-span-6">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            <span className="h-px w-8 bg-accent" />
            {hero.eyebrow}
          </p>

          <h1 className="mt-5 font-display text-4xl font-medium leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {hero.titleLead}
            <br />
            <em className="italic text-accent">{hero.titleEmphasis}</em> {hero.titleTail}
          </h1>

          <p className="mt-5 max-w-md text-base text-muted sm:text-lg">{hero.subtitle}</p>

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href={hero.primaryCta.href}>
              <Button size="lg" variant="accent" className="w-full sm:w-auto">
                {hero.primaryCta.label}
              </Button>
            </Link>
            <Link href={hero.secondaryCta.href}>
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                {hero.secondaryCta.label}
              </Button>
            </Link>
          </div>

          <div className="mt-8 flex items-center gap-4">
            <div className="flex -space-x-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-9 w-9 rounded-full border-2 border-canvas bg-accent-soft" />
              ))}
            </div>
            <div className="text-sm">
              <div className="flex items-center gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-current text-accent" />
                ))}
              </div>
              <p className="mt-0.5 text-muted">{hero.ratingText}</p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-6">
          <div className="relative">
            {fp?.image ? (
              <Link href={`/products/${fp.slug}`} className="block overflow-hidden rounded-[2rem]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={fp.image} alt={fp.title} className="aspect-[4/5] w-full object-cover sm:aspect-[16/10] lg:aspect-auto lg:h-[460px]" />
              </Link>
            ) : (
              <>
                <span className="absolute left-3 top-3 z-10 rounded-full border border-dashed border-muted/50 bg-canvas/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted/70">Placeholder · hero image</span>
                <Placeholder ratio="aspect-[4/5] sm:aspect-[16/10] lg:aspect-auto lg:h-[460px]" label="Hero image" className="rounded-[2rem]" />
              </>
            )}

            {fp ? (
              <Link href={`/products/${fp.slug}`} className="absolute -bottom-6 -left-6 hidden w-56 rounded-2xl border border-line bg-card p-4 shadow-xl transition-transform hover:-translate-y-0.5 sm:block">
                <div className="flex items-center gap-3">
                  <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-accent-soft">
                    {fp.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={fp.image} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">Featured</p>
                    <p className="truncate font-display text-sm leading-tight">{fp.title}</p>
                    <p className="text-sm font-semibold">{config.currency}{fp.priceFrom.toLocaleString("en-IN")}</p>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="absolute -bottom-6 -left-6 hidden w-56 rounded-2xl border border-line bg-card p-4 shadow-xl sm:block">
                <span className="absolute right-2 top-2 rounded-full border border-dashed border-muted/50 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted/70">Placeholder</span>
                <div className="flex items-center gap-3">
                  <Placeholder ratio="aspect-square" className="w-14 rounded-xl" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-accent">Featured</p>
                    <p className="font-display text-sm leading-tight">Pick in Site Config</p>
                    <p className="text-sm font-semibold">{config.currency} 0000</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
