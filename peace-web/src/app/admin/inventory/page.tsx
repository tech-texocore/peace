"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search, X, AlertTriangle, Plus, Minus, Boxes, ChevronDown } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { cn } from "@/lib/utils/cn";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { useSort, SortTh } from "@/components/admin/sortable";

interface Row { id: string; sku: string; stock: number; attributes: Record<string, string> | null; price: number; mrp: number | null; product: string; productId: string; slug: string; brand: string | null; image: string | null; low: boolean; out: boolean }
interface Resp { items: Row[]; total: number; lowCount: number; outCount: number; threshold: number }
interface Opt { id: string; name: string }

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function InventoryPage() {
  const { storeId, hasPermission } = useAdminAuth();
  const [data, setData] = useState<Resp | null>(null);
  const [categories, setCategories] = useState<Opt[]>([]);
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [adjust, setAdjust] = useState<Row | null>(null);
  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState("restock");
  const [busy, setBusy] = useState(false);
  const { sort, toggle, apply } = useSort();

  const q = storeId ? `storeId=${storeId}` : "";
  const canEdit = hasPermission("inventory.update");

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const p = new URLSearchParams(q);
    if (search) p.set("search", search);
    if (categoryId) p.set("categoryId", categoryId);
    if (stockStatus) p.set("stockStatus", stockStatus);
    p.set("limit", "100");
    try { setData(await api.get<Resp>(`/inventory?${p}`, { auth: true })); }
    finally { setLoading(false); }
  }, [storeId, q, search, categoryId, stockStatus]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!storeId) return;
    api.get<{ id: string; name: string; children?: unknown[] }[]>(`/categories?${q}`, { auth: true }).then((tree) => {
      const flat: Opt[] = [];
      const walk = (nodes: { id: string; name: string; children?: unknown[] }[]) => nodes.forEach((n) => { flat.push({ id: n.id, name: n.name }); if (Array.isArray(n.children)) walk(n.children as typeof nodes); });
      walk(tree ?? []);
      setCategories(flat);
    }).catch(() => {});
  }, [storeId, q]);

  async function submitAdjust() {
    if (!adjust || !delta) return;
    setBusy(true);
    try { await api.post(`/inventory/${adjust.id}/adjust?${q}`, { delta, reason }, { auth: true }); setAdjust(null); await load(); }
    finally { setBusy(false); }
  }

  const rows = apply(data?.items ?? [], {
    product: (r) => r.product, brand: (r) => r.brand ?? "", sku: (r) => r.sku, price: (r) => r.price, stock: (r) => r.stock,
  });
  const active = search || categoryId || stockStatus;

  return (
    <div className="w-full">
      <PageHeader title="Inventory" description="Check and adjust stock for every size/colour you sell. Low or out-of-stock items are flagged so you can restock in time." />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total items" value={String(data?.total ?? "—")} />
        <Stat label="In stock" value={data ? String(data.total - data.lowCount - data.outCount) : "—"} />
        <Stat label="Low stock" value={String(data?.lowCount ?? "—")} tone={data && data.lowCount > 0 ? "amber" : undefined} />
        <Stat label="Out of stock" value={String(data?.outCount ?? "—")} tone={data && data.outCount > 0 ? "rose" : undefined} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product or SKU…" className="h-10 w-64 rounded-full border border-line bg-card pl-9 pr-4 text-sm outline-none focus:border-accent" />
        </div>
        {[{ v: stockStatus, set: setStockStatus, opts: [["", "All stock"], ["in", "In stock"], ["low", "Low stock"], ["out", "Out of stock"]] },
          { v: categoryId, set: setCategoryId, opts: [["", "All categories"], ...categories.map((c) => [c.id, c.name] as [string, string])] }].map((f, i) => (
          <div key={i} className="relative">
            <select value={f.v} onChange={(e) => f.set(e.target.value)} className="h-10 appearance-none rounded-full border border-line bg-card pl-4 pr-9 text-sm outline-none focus:border-accent">
              {f.opts.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          </div>
        ))}
        {active && <button onClick={() => { setSearch(""); setCategoryId(""); setStockStatus(""); }} className="text-sm font-medium text-accent hover:underline">Clear</button>}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Boxes} title={active ? "No items match your filters" : "No stock yet"} description={active ? "Try clearing the filters." : "Stock appears here once you add products with variants."} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-accent-soft/40 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <SortTh label="Product" sortKey="product" sort={sort} onSort={toggle} />
                <th className="px-4 py-3">Variant</th>
                <SortTh label="SKU" sortKey="sku" sort={sort} onSort={toggle} />
                <SortTh label="Price" sortKey="price" sort={sort} onSort={toggle} align="right" className="text-right" />
                <SortTh label="Stock" sortKey="stock" sort={sort} onSort={toggle} align="right" className="text-right" />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line hover:bg-accent-soft/20">
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${r.productId}`} className="flex items-center gap-3 hover:text-accent">
                      <span className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-line bg-accent-soft/30">{r.image && <img src={r.image} alt="" className="h-full w-full object-cover" />}</span>
                      <span><span className="font-medium">{r.product}</span>{r.brand && <span className="block text-xs font-normal text-muted">{r.brand}</span>}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{r.attributes ? Object.values(r.attributes).join(" · ") : "—"}</td>
                  <td className="px-4 py-3 text-muted">{r.sku}</td>
                  <td className="px-4 py-3 text-right">{inr(r.price)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn("inline-flex items-center gap-1 font-medium", r.out && "text-rose-600", r.low && "text-amber-600")}>
                      {(r.low || r.out) && <AlertTriangle className="h-3.5 w-3.5" />}{r.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{canEdit && <button onClick={() => { setAdjust(r); setDelta(1); setReason("restock"); }} className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium hover:bg-accent-soft">Adjust</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/50" onClick={() => setAdjust(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-2xl">
            <div className="mb-1 flex items-center justify-between"><h3 className="font-display text-lg">Adjust stock</h3><button onClick={() => setAdjust(null)}><X className="h-5 w-5" /></button></div>
            <p className="mb-4 text-sm text-muted">{adjust.product} · {adjust.sku} · current <span className="font-medium text-ink">{adjust.stock}</span></p>
            <div className="mb-3 flex items-center gap-3">
              <div className="inline-flex items-center rounded-full border border-line">
                <button onClick={() => setDelta((d) => d - 1)} className="p-2.5 hover:text-accent"><Minus className="h-4 w-4" /></button>
                <span className="min-w-14 text-center text-sm font-medium">{delta > 0 ? `+${delta}` : delta}</span>
                <button onClick={() => setDelta((d) => d + 1)} className="p-2.5 hover:text-accent"><Plus className="h-4 w-4" /></button>
              </div>
              <span className="text-sm text-muted">New: <span className="font-medium text-ink">{adjust.stock + delta}</span></span>
            </div>
            <select value={reason} onChange={(e) => setReason(e.target.value)} className="mb-4 h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent">
              <option value="restock">Restock (new stock received)</option>
              <option value="correction">Correction (count was wrong)</option>
              <option value="damage">Damage / loss</option>
              <option value="return">Return added back</option>
            </select>
            <button onClick={submitAdjust} disabled={busy || delta === 0 || adjust.stock + delta < 0} className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-semibold text-accent-foreground disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Apply</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "amber" | "rose" }) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className={cn("mt-1 font-display text-2xl font-medium", tone === "amber" && "text-amber-600", tone === "rose" && "text-rose-600")}>{value}</p>
    </div>
  );
}
