import Link from "next/link";
import { AtSign, Send, Share2 } from "lucide-react";
import { Container } from "./container";
import type { SiteConfig } from "@/lib/site-config";

const socials = [AtSign, Send, Share2];

export function Footer({ config }: { config: SiteConfig }) {
  const { brand, footer } = config;

  return (
    <footer className="mt-auto border-t border-line bg-card">
      <Container className="grid grid-cols-2 gap-x-8 gap-y-8 py-10 sm:grid-cols-3 lg:grid-cols-5">
        <div className="col-span-2 lg:col-span-2">
          <h3 className="font-display text-xl font-medium">{brand.name}</h3>
          <p className="mt-2 max-w-xs text-sm text-muted">{brand.tagline}</p>
          <div className="mt-4 flex gap-2">
            {socials.map((Icon, i) => (
              <Link
                key={i}
                href="#"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted hover:border-ink hover:text-ink"
              >
                <Icon className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </div>

        {footer.groups.map((group) => (
          <div key={group.title}>
            <h4 className="text-xs font-semibold uppercase tracking-widest text-muted">
              {group.title}
            </h4>
            <ul className="mt-3 space-y-2">
              {group.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className="text-sm text-ink/80 hover:text-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>

      <div className="border-t border-line py-4">
        <Container className="flex flex-col items-center justify-between gap-2 text-xs text-muted sm:flex-row">
          <p>© {brand.name}. All rights reserved.</p>
          <p>{footer.note}</p>
        </Container>
      </div>
    </footer>
  );
}
