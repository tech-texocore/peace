"use client";

import { Truck, RotateCcw, ShieldCheck, Headphones, type LucideIcon } from "lucide-react";
import { useSiteConfig } from "@/context/site-config-context";
import { cn } from "@/lib/utils/cn";
import type { ValueProp } from "@/lib/site-config";

const icons: Record<ValueProp["icon"], LucideIcon> = {
  shipping: Truck,
  returns: RotateCcw,
  secure: ShieldCheck,
  support: Headphones,
};

export function TrustBadges({ limit = 3, className }: { limit?: number; className?: string }) {
  const { valueProps } = useSiteConfig();
  const items = valueProps.slice(0, limit);
  if (!items.length) return null;
  return (
    <div className={cn("grid gap-2 text-center text-[11px] text-muted", className)} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((p) => {
        const Icon = icons[p.icon];
        return (
          <span key={p.title} title={p.text} className="flex flex-col items-center gap-1">
            <Icon className="h-4 w-4 text-accent" /> {p.title}
          </span>
        );
      })}
    </div>
  );
}
