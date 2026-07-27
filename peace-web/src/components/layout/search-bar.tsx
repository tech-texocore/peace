"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, TrendingUp } from "lucide-react";
import { api } from "@/lib/api/client";
import { env } from "@/lib/config/env";
import { control } from "@/lib/tokens";

interface Suggest {
  products: { slug: string; title: string; image: string | null }[];
  categories: { slug: string; name: string }[];
  brands: { slug: string; name: string }[];
}
const EMPTY: Suggest = { products: [], categories: [], brands: [] };

export function SearchBar() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [data, setData] = useState<Suggest>(EMPTY);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) { setData(EMPTY); return; }
    setLoading(true);
    const t = setTimeout(() => {
      api.get<Suggest>(`/storefront/${env.storeSlug}/suggest?q=${encodeURIComponent(query)}`)
        .then((d) => setData(d ?? EMPTY)).catch(() => setData(EMPTY)).finally(() => setLoading(false));
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  function go(href: string) { setOpen(false); setQ(""); router.push(href); }
  function submit() { if (q.trim()) go(`/products?search=${encodeURIComponent(q.trim())}`); }

  const hasResults = data.products.length || data.categories.length || data.brands.length;

  return (
    <>
      <button aria-label="Search" onClick={() => setOpen(true)} className={control.iconButton}>
        <Search className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] bg-black/40" onClick={() => setOpen(false)}>
          <div className="mx-auto mt-0 w-full bg-canvas p-4 shadow-lg sm:mt-20 sm:max-w-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 rounded-full border border-line px-4">
              <Search className="h-5 w-5 text-muted" />
              <input
                ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
                placeholder="Search sarees, kurtis, fabrics…"
                className="h-12 flex-1 bg-transparent text-sm outline-none"
              />
              {loading && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
              <button onClick={() => setOpen(false)} aria-label="Close" className="rounded-full p-1 hover:bg-accent-soft"><X className="h-5 w-5" /></button>
            </div>

            {q.trim().length >= 2 && (
              <div className="mt-3 max-h-[60vh] overflow-y-auto">
                {!hasResults && !loading ? (
                  <p className="py-6 text-center text-sm text-muted">No matches. Press Enter to search all.</p>
                ) : (
                  <div className="space-y-4">
                    {data.products.length > 0 && (
                      <div>
                        <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted">Products</p>
                        {data.products.map((p) => (
                          <button key={p.slug} onClick={() => go(`/products/${p.slug}`)} className="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left hover:bg-accent-soft">
                            <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-line bg-accent-soft/30">{p.image && <img src={p.image} alt="" className="h-full w-full object-cover" />}</span>
                            <span className="text-sm">{p.title}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {(data.categories.length > 0 || data.brands.length > 0) && (
                      <div className="flex flex-wrap gap-1.5">
                        {data.categories.map((c) => <button key={c.slug} onClick={() => go(`/products?category=${c.slug}`)} className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-accent-soft">in {c.name}</button>)}
                        {data.brands.map((b) => <button key={b.slug} onClick={() => go(`/products?search=${encodeURIComponent(b.name)}`)} className="rounded-full border border-line px-3 py-1.5 text-xs hover:bg-accent-soft">{b.name}</button>)}
                      </div>
                    )}
                    <button onClick={submit} className="flex w-full items-center gap-2 rounded-lg px-1 py-2 text-left text-sm font-medium text-accent hover:bg-accent-soft">
                      <TrendingUp className="h-4 w-4" /> Search for “{q.trim()}”
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
