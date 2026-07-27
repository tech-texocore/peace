"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search, Mail, BellRing, Package, Check, Clock } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { cn } from "@/lib/utils/cn";

interface NewsRow { id: string; email: string; source: string; status: string; isMember: boolean; createdAt: string }
interface StockRow { id: string; email: string; notified: boolean; createdAt: string; product: string; productId: string; slug: string; image: string | null; sku: string; stock: number; attributes: Record<string, string> | null }

const date = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function SubscriptionsPage() {
  const { storeId } = useAdminAuth();
  const [tab, setTab] = useState<"newsletter" | "stock">("newsletter");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState<{ items: NewsRow[]; active: number; total: number } | null>(null);
  const [stock, setStock] = useState<{ items: StockRow[]; pending: number; total: number } | null>(null);

  const q = storeId ? `storeId=${storeId}` : "";

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const p = new URLSearchParams(q);
    if (search) p.set("search", search);
    try {
      if (tab === "newsletter") setNews(await api.get(`/subscriptions/newsletter?${p}`, { auth: true }));
      else setStock(await api.get(`/subscriptions/back-in-stock?${p}`, { auth: true }));
    } finally { setLoading(false); }
  }, [storeId, q, tab, search]);

  useEffect(() => { load(); }, [load]);

  const [busy, setBusy] = useState<string | null>(null);
  async function notify(id: string) {
    setBusy(id);
    try { await api.post(`/subscriptions/back-in-stock/${id}/notify?${q}`, {}, { auth: true }); await load(); }
    finally { setBusy(null); }
  }
  async function notifyAll() {
    setBusy("all");
    try { await api.post(`/subscriptions/back-in-stock/notify-all?${q}`, {}, { auth: true }); await load(); }
    finally { setBusy(null); }
  }
  const eligible = (stock?.items ?? []).filter((r) => !r.notified && r.stock > 0).length;

  const tabs = [
    { key: "newsletter" as const, label: "Newsletter", count: news?.active },
    { key: "stock" as const, label: "Back in stock", count: stock?.pending },
  ];

  return (
    <div className="w-full">
      <PageHeader title="Subscriptions" description="People who asked to hear from you — newsletter signups and back-in-stock alerts. Newsletter signups don't need an account." />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => { setTab(t.key); setSearch(""); }} className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors", tab === t.key ? "border-accent bg-accent text-accent-foreground" : "border-line hover:bg-accent-soft")}>
            {t.key === "newsletter" ? <Mail className="h-4 w-4" /> : <BellRing className="h-4 w-4" />}
            {t.label}
            {t.count != null && t.count > 0 && <span className={cn("rounded-full px-1.5 text-xs font-semibold", tab === t.key ? "bg-white/20" : "bg-accent-soft text-accent")}>{t.count}</span>}
          </button>
        ))}
        {tab === "stock" && eligible > 0 && (
          <button onClick={notifyAll} disabled={busy === "all"} className="ml-auto inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50">
            {busy === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Notify {eligible} in stock
          </button>
        )}
        <div className={cn("relative", !(tab === "stock" && eligible > 0) && "ml-auto")}>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === "newsletter" ? "Search email" : "Search email or product"} className="h-9 w-64 rounded-full border border-line bg-canvas pl-9 pr-3 text-sm outline-none focus:border-accent" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>
      ) : tab === "newsletter" ? (
        !news?.items.length ? (
          <EmptyState icon={Mail} title={search ? "No matching subscribers" : "No newsletter signups yet"} description={search ? "Try a different email." : "When someone subscribes from the storefront, they'll appear here."} />
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-accent-soft/40 text-left text-xs uppercase tracking-wide text-muted">
                <tr><th className="px-4 py-3">Email</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Subscribed</th></tr>
              </thead>
              <tbody>
                {news.items.map((s) => (
                  <tr key={s.id} className="border-t border-line">
                    <td className="px-4 py-3 font-medium">{s.email}</td>
                    <td className="px-4 py-3 text-muted capitalize">{s.source}</td>
                    <td className="px-4 py-3">{s.isMember ? <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">Registered</span> : <span className="text-muted">Guest</span>}</td>
                    <td className="px-4 py-3"><span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", s.status === "SUBSCRIBED" ? "bg-accent-soft text-accent" : "bg-black/5 text-muted dark:bg-white/10")}>{s.status === "SUBSCRIBED" ? "Subscribed" : "Unsubscribed"}</span></td>
                    <td className="px-4 py-3 text-muted">{date(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : !stock?.items.length ? (
        <EmptyState icon={BellRing} title={search ? "No matching requests" : "No back-in-stock requests"} description={search ? "Try a different email or product." : "When a shopper taps “Notify me” on a sold-out product, it shows here."} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-accent-soft/40 text-left text-xs uppercase tracking-wide text-muted">
              <tr><th className="px-4 py-3">Product</th><th className="px-4 py-3">Variant</th><th className="px-4 py-3">Email</th><th className="px-4 py-3 text-right">Stock</th><th className="px-4 py-3">Requested</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody>
              {stock.items.map((r) => (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Link href={`/admin/products/${r.productId}`} className="flex items-center gap-3 font-medium hover:text-accent">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-canvas">{r.image ? <img src={r.image} alt="" className="h-full w-full object-cover" /> : <Package className="h-4 w-4 text-muted" />}</span>
                      {r.product}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{r.attributes ? Object.values(r.attributes).join(" · ") : r.sku}</td>
                  <td className="px-4 py-3">{r.email}</td>
                  <td className={cn("px-4 py-3 text-right font-medium", r.stock > 0 ? "text-accent" : "text-danger")}>{r.stock}</td>
                  <td className="px-4 py-3 text-muted">{date(r.createdAt)}</td>
                  <td className="px-4 py-3">
                    {r.notified ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-accent"><Check className="h-3.5 w-3.5" /> Notified</span>
                    ) : r.stock > 0 ? (
                      <button onClick={() => notify(r.id)} disabled={busy === r.id} className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50">
                        {busy === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />} Notify
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400"><Clock className="h-3.5 w-3.5" /> Waiting for stock</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
