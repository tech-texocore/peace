"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import type { ProductFacets } from "@/lib/storefront-server";

export function FilterSidebar({ facets }: { facets: ProductFacets }) {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const [minP, setMinP] = useState(params.get("minPrice") ?? "");
  const [maxP, setMaxP] = useState(params.get("maxPrice") ?? "");

  function push(next: URLSearchParams) { next.delete("page"); router.push(`${pathname}?${next.toString()}`); }
  function toggleMulti(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    const cur = (next.get(key)?.split(",") ?? []).filter(Boolean);
    const updated = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    if (updated.length) next.set(key, updated.join(",")); else next.delete(key);
    push(next);
  }
  function toggleBool(key: string) {
    const next = new URLSearchParams(params.toString());
    next.get(key) === "true" ? next.delete(key) : next.set(key, "true");
    push(next);
  }
  function applyPrice() {
    const next = new URLSearchParams(params.toString());
    minP ? next.set("minPrice", minP) : next.delete("minPrice");
    maxP ? next.set("maxPrice", maxP) : next.delete("maxPrice");
    push(next);
  }
  function clearAll() {
    const next = new URLSearchParams();
    const cat = params.get("category"); if (cat) next.set("category", cat);
    const col = params.get("collection"); if (col) next.set("collection", col);
    const sort = params.get("sort"); if (sort) next.set("sort", sort);
    setMinP(""); setMaxP("");
    router.push(`${pathname}?${next.toString()}`);
  }

  const sel = (key: string) => (params.get(key)?.split(",") ?? []).filter(Boolean);
  const chip = (on: boolean) => cn("rounded-full border px-3 py-1.5 text-xs transition-colors", on ? "border-accent bg-accent text-accent-foreground" : "border-line hover:bg-accent-soft");
  const active = ["colours", "sizes", "fabrics", "minPrice", "maxPrice", "discount"].some((k) => params.get(k));

  return (
    <aside className="space-y-6 text-sm">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg">Filters</h2>
        {active && <button onClick={clearAll} className="text-xs font-medium text-accent hover:underline">Clear all</button>}
      </div>

      {facets.colours.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Colour</p>
          <div className="flex flex-wrap gap-1.5">
            {facets.colours.map((c) => (
              <button key={c.value} onClick={() => toggleMulti("colours", c.value)} className={chip(sel("colours").includes(c.value))}>
                <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full border border-black/15 align-middle" style={{ background: c.value.toLowerCase() }} />{c.value}
              </button>
            ))}
          </div>
        </div>
      )}

      {facets.sizes.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Size</p>
          <div className="flex flex-wrap gap-1.5">
            {facets.sizes.map((c) => <button key={c.value} onClick={() => toggleMulti("sizes", c.value)} className={chip(sel("sizes").includes(c.value))}>{c.value}</button>)}
          </div>
        </div>
      )}

      {facets.fabrics.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Fabric</p>
          <div className="flex flex-wrap gap-1.5">
            {facets.fabrics.map((c) => <button key={c.value} onClick={() => toggleMulti("fabrics", c.value)} className={chip(sel("fabrics").includes(c.value))}>{c.value} <span className="text-muted/60">({c.count})</span></button>)}
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Price (₹{facets.priceRange.min}–₹{facets.priceRange.max})</p>
        <div className="flex items-center gap-2">
          <input value={minP} onChange={(e) => setMinP(e.target.value)} type="number" placeholder="Min" className="h-9 w-full rounded-lg border border-line bg-canvas px-2 text-sm outline-none focus:border-accent" />
          <span className="text-muted">–</span>
          <input value={maxP} onChange={(e) => setMaxP(e.target.value)} type="number" placeholder="Max" className="h-9 w-full rounded-lg border border-line bg-canvas px-2 text-sm outline-none focus:border-accent" />
          <button onClick={applyPrice} className="h-9 shrink-0 rounded-lg border border-line px-3 text-xs hover:bg-accent-soft">Go</button>
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2"><input type="checkbox" checked={params.get("discount") === "true"} onChange={() => toggleBool("discount")} className="h-4 w-4 accent-[var(--accent)]" /> On sale</label>
      </div>
    </aside>
  );
}
