import type { SiteConfig } from "@/lib/site-config";

export function AnnouncementBar({ config }: { config: SiteConfig }) {
  const messages = config.announcements;
  return (
    <div className="bg-accent text-accent-foreground">
      <div className="mx-auto flex max-w-[1720px] items-center justify-center gap-6 px-4 py-2 text-[11px] font-medium uppercase tracking-widest">
        {messages.map((m, i) => (
          <span key={m} className={i > 0 ? "hidden sm:inline" : ""}>
            {i > 0 && <span className="mr-6 opacity-40">✦</span>}
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}
