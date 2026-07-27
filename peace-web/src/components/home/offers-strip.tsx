"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Section } from "@/components/layout/section";
import { SectionHeading } from "@/components/ui/section-heading";
import { cn } from "@/lib/utils/cn";
import { gap } from "@/lib/tokens";
import type { SiteConfig } from "@/lib/site-config";
import type { StoreOffer } from "@/lib/storefront-server";

export function OffersStrip({ config, offers }: { config: SiteConfig; offers: StoreOffer[] }) {
  const { sections } = config;
  const [copied, setCopied] = useState<string | null>(null);
  if (!offers.length) return null;

  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1500);
    });
  }

  return (
    <Section>
      <SectionHeading eyebrow={sections.offers.eyebrow} title={sections.offers.title} description={sections.offers.description} />
      <div className={cn("grid sm:grid-cols-3", gap.grid)}>
        {offers.map((c) => (
          <div key={c.code} className="relative flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-dashed border-accent/50 bg-accent-soft p-6">
            <span className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-canvas" />
            <span className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-canvas" />
            <div>
              <p className="font-display text-lg">{c.label}</p>
              <p className="mt-1 text-xs text-muted">{c.note}</p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-semibold text-accent">{c.code}</p>
              <button onClick={() => copy(c.code)} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-widest text-ink underline underline-offset-2">
                {copied === c.code ? <><Check className="h-3 w-3" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
