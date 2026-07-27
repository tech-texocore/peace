"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { StoreCategory } from "@/lib/storefront-server";

export function PlpControls({ categories, total }: { categories: StoreCategory[]; total: number }) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const active = params.get("category") ?? "";
  const sort = params.get("sort") ?? "";

  function set(key: string, value: string) {
    const p = new URLSearchParams(params.toString());
    if (value) p.set(key, value); else p.delete(key);
    p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  }

  const goCategory = (slug: string) => router.push(slug ? `/products?category=${slug}` : "/products");

  const pill = (on: boolean) => cn("rounded-full border px-4 py-1.5 text-sm transition-colors", on ? "border-accent bg-accent text-accent-foreground" : "border-line hover:bg-accent-soft");

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => goCategory("")} className={pill(!active && pathname === "/products")}>All</button>
        {categories.map((c) => <button key={c.slug} onClick={() => goCategory(c.slug)} className={pill(active === c.slug)}>{c.name}</button>)}
      </div>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted">{total} item{total === 1 ? "" : "s"}</span>
        <div className="relative">
          <select value={sort} onChange={(e) => set("sort", e.target.value)} className="h-10 appearance-none rounded-full border border-line bg-card pl-4 pr-9 text-sm outline-none focus:border-accent">
            <option value="">Newest</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="discount">Biggest discount</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        </div>
      </div>
    </div>
  );
}
