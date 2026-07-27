"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Trash2, Pencil, Search, ChevronDown, Package } from "lucide-react";
import { useSort, SortTh } from "@/components/admin/sortable";
import { EmptyState } from "@/components/admin/empty-state";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils/cn";

type Status = "DRAFT" | "ACTIVE" | "ARCHIVED";
interface ProductRow {
  id: string; title: string; slug: string; status: Status;
  seller: { id: string; name: string }; category?: { id: string; name: string } | null;
  media: { url: string }[]; priceFrom: number | null; stock: number; _count: { variants: number };
}
interface Opt { id: string; name: string }

const statusStyle: Record<Status, string> = {
  ACTIVE: "bg-accent-soft text-accent",
  DRAFT: "bg-black/5 text-muted dark:bg-white/10",
  ARCHIVED: "bg-danger/10 text-danger",
};

export default function ProductsPage() {
  const { storeId, hasPermission } = useAdminAuth();
  const confirm = useConfirm();
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | Status>("");
  const [sellerId, setSellerId] = useState("");
  const [sellers, setSellers] = useState<Opt[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Opt[]>([]);
  const [loading, setLoading] = useState(true);
  const { sort, toggle, apply } = useSort();
  const limit = 20;

  const canCreate = hasPermission("products.create");
  const canUpdate = hasPermission("products.update");
  const canDelete = hasPermission("products.delete");
  const q = storeId ? `storeId=${storeId}` : "";

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const params = new URLSearchParams(q);
    params.set("page", String(page)); params.set("limit", String(limit));
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    if (sellerId) params.set("sellerId", sellerId);
    if (categoryId) params.set("categoryId", categoryId);
    const res = await api.get<{ items: ProductRow[]; total: number }>(`/products?${params}`, { auth: true });
    setRows(res.items); setTotal(res.total); setLoading(false);
  }, [storeId, q, page, search, status, sellerId, categoryId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!storeId) return;
    api.get<{ items: Opt[] }>(`/sellers?${q}&limit=100`, { auth: true }).then((r) => setSellers(r.items));
    api.get<{ id: string; name: string; children?: unknown[] }[]>(`/categories?${q}`, { auth: true }).then((tree) => {
      const flat: Opt[] = [];
      const walk = (nodes: { id: string; name: string; children?: unknown[] }[]) => nodes.forEach((n) => { flat.push({ id: n.id, name: n.name }); if (Array.isArray(n.children)) walk(n.children as typeof nodes); });
      walk(tree ?? []);
      setCategories(flat);
    }).catch(() => {});
  }, [storeId, q]);

  async function remove(p: ProductRow) {
    const ok = await confirm({ title: `Delete “${p.title}”?`, message: "The product and its variants will be removed. Products with order history can’t be deleted — archive them instead.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await api.delete(`/products/${p.id}?${q}`, { auth: true });
      setRows((r) => r.filter((x) => x.id !== p.id));
    } catch (err) { await confirm({ title: "Cannot delete", message: (err as Error).message, confirmLabel: "OK" }); }
  }

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium">Products</h1>
          <p className="mt-1 text-sm text-muted">Your catalog — {total} product{total === 1 ? "" : "s"}.</p>
        </div>
        {canCreate && <Link href="/admin/products/new" className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90"><Plus className="h-4 w-4" /> New product</Link>}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search title or brand…" className="h-10 w-64 rounded-full border border-line bg-card pl-9 pr-4 text-sm outline-none focus:border-accent" />
        </div>
        {[{ v: status, set: (x: string) => { setStatus(x as "" | Status); setPage(1); }, opts: [["", "All statuses"], ["ACTIVE", "Active"], ["DRAFT", "Draft"], ["ARCHIVED", "Archived"]] },
          { v: categoryId, set: (x: string) => { setCategoryId(x); setPage(1); }, opts: [["", "All categories"], ...categories.map((c) => [c.id, c.name] as [string, string])] },
          { v: sellerId, set: (x: string) => { setSellerId(x); setPage(1); }, opts: [["", "All sellers"], ...sellers.map((s) => [s.id, s.name] as [string, string])] }].map((f, i) => (
          <div key={i} className="relative">
            <select value={f.v} onChange={(e) => f.set(e.target.value)} className="h-10 appearance-none rounded-full border border-line bg-card pl-4 pr-9 text-sm outline-none focus:border-accent">
              {f.opts.map(([val, label]) => <option key={val} value={val}>{label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <SortTh label="Product" sortKey="product" sort={sort} onSort={toggle} className="px-5 py-3 font-semibold" />
              <SortTh label="Seller" sortKey="seller" sort={sort} onSort={toggle} className="px-5 py-3 font-semibold" />
              <SortTh label="Category" sortKey="category" sort={sort} onSort={toggle} className="px-5 py-3 font-semibold" />
              <SortTh label="Price from" sortKey="price" sort={sort} onSort={toggle} className="px-5 py-3 font-semibold" />
              <SortTh label="Stock" sortKey="stock" sort={sort} onSort={toggle} className="px-5 py-3 font-semibold" />
              <SortTh label="Status" sortKey="status" sort={sort} onSort={toggle} className="px-5 py-3 font-semibold" />
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="p-0"><EmptyState icon={Package} title={search || status || categoryId || sellerId ? "No products match your filters" : "No products yet"} description={search || status || categoryId || sellerId ? "Try clearing the search or filters." : "Add your first product to start selling."} action={canCreate && !(search || status || categoryId || sellerId) ? <Link href="/admin/products/new" className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90"><Plus className="h-4 w-4" /> New product</Link> : undefined} /></td></tr>
            ) : apply(rows, { product: (p) => p.title, seller: (p) => p.seller.name, category: (p) => p.category?.name ?? "", price: (p) => p.priceFrom ?? 0, stock: (p) => p.stock, status: (p) => p.status }).map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 font-medium hover:text-accent">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-canvas">
                      {p.media[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.media[0].url} alt="" className="h-full w-full object-cover" />
                      ) : <Package className="h-4 w-4 text-muted" />}
                    </span>
                    <span>{p.title}<span className="block text-xs font-normal text-muted">{p._count.variants} variant{p._count.variants === 1 ? "" : "s"}</span></span>
                  </Link>
                </td>
                <td className="px-5 py-3 text-muted">{p.seller.name}</td>
                <td className="px-5 py-3 text-muted">{p.category?.name ?? "—"}</td>
                <td className="px-5 py-3">{p.priceFrom != null ? `₹${p.priceFrom.toLocaleString("en-IN")}` : "—"}</td>
                <td className={cn("px-5 py-3", p.stock === 0 ? "text-danger" : "text-muted")}>{p.stock}</td>
                <td className="px-5 py-3"><span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", statusStyle[p.status])}>{p.status[0] + p.status.slice(1).toLowerCase()}</span></td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {canUpdate && <Link href={`/admin/products/${p.id}`} className="rounded-lg p-1.5 hover:bg-accent-soft" title="Edit"><Pencil className="h-4 w-4" /></Link>}
                    {canDelete && <button onClick={() => remove(p)} className="rounded-lg p-1.5 text-danger hover:bg-danger/10" title="Delete"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm text-muted">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40 hover:bg-accent-soft">Prev</button>
          <span>Page {page} / {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className="rounded-lg border border-line px-3 py-1.5 disabled:opacity-40 hover:bg-accent-soft">Next</button>
        </div>
      )}
    </div>
  );
}
