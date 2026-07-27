import { Star, BadgeCheck } from "lucide-react";
import { Section } from "@/components/layout/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/utils/cn";
import { gap, surface } from "@/lib/tokens";
import type { SiteConfig } from "@/lib/site-config";
import type { StoreTestimonial } from "@/lib/storefront-server";

export function Testimonials({ config, items }: { config: SiteConfig; items: StoreTestimonial[] }) {
  const { sections } = config;
  const cols = items.length >= 3 ? "md:grid-cols-3" : items.length === 2 ? "md:grid-cols-2" : "md:grid-cols-1";

  return (
    <Section>
      <SectionHeading eyebrow={sections.testimonials.eyebrow} title={sections.testimonials.title} align="center" />
      <div className={cn("grid", cols, gap.grid)}>
        {items.slice(0, 6).map((r, i) => (
          <figure key={i} className={cn("flex flex-col p-8", surface.card)}>
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3, 4].map((s) => (
                <Star key={s} className={cn("h-4 w-4", s < r.rating ? "fill-current text-accent" : "text-line")} />
              ))}
            </div>
            <blockquote className="mt-5 flex-1 font-display text-lg italic leading-relaxed">“{r.quote}”</blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent-foreground">
                {r.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="flex items-center gap-1 text-sm font-semibold">
                  {r.name}
                  {r.verified && <BadgeCheck className="h-4 w-4 text-accent" aria-label="Verified purchase" />}
                </p>
                {r.location && <p className="text-xs text-muted">{r.location}</p>}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </Section>
  );
}
