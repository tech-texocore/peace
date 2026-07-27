import { Section } from "@/components/layout/section";
import type { SiteConfig } from "@/lib/site-config";
import type { NewsletterOffer } from "@/lib/storefront-server";
import { NewsletterForm } from "@/components/home/newsletter-form";

export function Newsletter({ config, offer }: { config: SiteConfig; offer?: NewsletterOffer | null }) {
  const { newsletter } = config;
  const title = offer ? `Get ${offer.offer} off your first order` : newsletter.title;

  return (
    <Section>
      <div className="relative overflow-hidden rounded-[2rem] bg-accent px-6 py-12 text-center text-accent-foreground lg:px-12 lg:py-16">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">
          {newsletter.eyebrow}
        </p>
        <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-medium leading-tight sm:text-4xl lg:text-5xl">
          {title}
        </h2>
        {offer?.code && (
          <p className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-accent-foreground/10 px-4 py-1.5 text-sm font-medium">
            Use code <span className="rounded bg-accent-foreground/15 px-2 py-0.5 font-mono font-semibold tracking-wide">{offer.code}</span>
            {offer.minSubtotal ? <span className="opacity-80">· Min. spend ₹{offer.minSubtotal.toLocaleString("en-IN")}</span> : null}
          </p>
        )}
        <p className="mx-auto mt-4 max-w-md text-sm opacity-80 sm:text-base">{newsletter.subtitle}</p>

        <NewsletterForm placeholder={newsletter.placeholder} cta={newsletter.cta} successCode={offer?.code ?? null} />
      </div>
    </Section>
  );
}
