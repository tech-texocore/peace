"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./footer";
import { CompactFooter } from "./compact-footer";
import type { SiteConfig } from "@/lib/site-config";

const HIDDEN = ["/checkout"];
const COMPACT = ["/account", "/cart", "/wishlist"];

const matches = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export function SiteFooter({ config }: { config: SiteConfig }) {
  const pathname = usePathname();
  if (matches(pathname, HIDDEN)) return null;
  if (matches(pathname, COMPACT)) return <CompactFooter config={config} />;
  return <Footer config={config} />;
}
