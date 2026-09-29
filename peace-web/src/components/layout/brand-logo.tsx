/* eslint-disable @next/next/no-img-element */
import type { CSSProperties } from "react";
import type { SiteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils/cn";

export const LOGO_DEFAULTS = { height: 40, mobileHeight: 30, footerHeight: 56 };

export function BrandLogo({ brand, place, height }: { brand: Partial<SiteConfig["brand"]>; place: "header" | "footer"; height?: number }) {
  const logo = brand.logo;
  if (!logo?.url) return <>{brand.name}</>;
  const desktop = height ?? (place === "footer" ? logo.footerHeight : logo.height) ?? LOGO_DEFAULTS.height;
  const mobile = height ?? (place === "footer" ? desktop : logo.mobileHeight) ?? LOGO_DEFAULTS.mobileHeight;
  return (
    <img
      src={logo.url}
      alt={brand.name ?? "Logo"}
      style={{ "--logo-h": `${desktop}px`, "--logo-mh": `${mobile}px` } as CSSProperties}
      className={cn(
        "block h-[var(--logo-mh)] w-auto object-contain lg:h-[var(--logo-h)]",
        // The header also holds the menu and icons, so a very wide logo is capped there.
        place === "header" ? "max-w-[55vw] lg:max-w-[360px]" : "max-w-full",
      )}
    />
  );
}
