import Link from "next/link";
import { Container } from "./container";
import type { SiteConfig } from "@/lib/site-config";

export function CompactFooter({ config }: { config: SiteConfig }) {
  const { brand, footer } = config;
  const links = footer.groups.flatMap((g) => g.links).slice(0, 5);
  return (
    <footer className="mt-auto border-t border-line bg-card">
      <Container className="flex flex-col items-center justify-between gap-2 py-4 text-xs text-muted sm:flex-row">
        <p>© {brand.name}. All rights reserved.</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          {links.map((l) => <Link key={l.href} href={l.href} className="hover:text-ink">{l.label}</Link>)}
        </nav>
      </Container>
    </footer>
  );
}
