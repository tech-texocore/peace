import type { SiteConfig } from "@/lib/site-config";

export function Marquee({ config }: { config: SiteConfig }) {
  const items = config.marquee ?? [];
  if (items.length === 0) return null;
  const row = [...items, ...items];
  return (
    <div className="border-y border-line bg-ink py-4 text-canvas">
      <div className="flex overflow-hidden">
        <div className="animate-marquee flex shrink-0 items-center gap-8 whitespace-nowrap pr-8">
          {row.map((item, i) => (
            <span key={i} className="flex items-center gap-8 font-display text-lg italic">
              {item}
              <span className="text-accent">✦</span>
            </span>
          ))}
        </div>
        <div className="animate-marquee flex shrink-0 items-center gap-8 whitespace-nowrap pr-8" aria-hidden>
          {row.map((item, i) => (
            <span key={i} className="flex items-center gap-8 font-display text-lg italic">
              {item}
              <span className="text-accent">✦</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
