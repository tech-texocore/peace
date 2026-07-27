"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IndianRupee, ShoppingCart, TrendingUp, Boxes, Undo2, Star, ArrowRight, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { OrderStatusBadge } from "@/components/store/order-status-badge";
import { cn } from "@/lib/utils/cn";
import { inr, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders";

interface Dash {
  revenue: number; orders: number; aov: number; unitsSold: number;
  statusCounts: Record<string, number>;
  trend: { date: string; label: string; revenue: number }[];
  topProducts: { productId: string; name: string; image: string | null; units: number; revenue: number }[];
  lowStock: number;
  customers: number;
  activeProducts: number;
  pending: { returns: number; reviews: number };
  recent: { id: string; orderNumber: string; total: number; status: string; createdAt: string; customer: string }[];
}

const PIPELINE: OrderStatus[] = ["PENDING", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];
const recentDate = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

export function DashboardStats() {
  const { storeId } = useAdminAuth();
  const [d, setD] = useState<Dash | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    setFailed(false);
    api.get<Dash>(`/analytics/dashboard?storeId=${storeId}`, { auth: true }).then(setD).catch(() => setFailed(true));
  }, [storeId]);

  if (failed) {
    return (
      <div className="mb-8 flex items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <span>Couldn&apos;t load your dashboard right now. Refresh the page to try again.</span>
      </div>
    );
  }

  if (!d) {
    return (
      <div className="mb-8 space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-[104px] animate-pulse rounded-2xl border border-line bg-card" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <div className="h-56 animate-pulse rounded-2xl border border-line bg-card" />
          <div className="h-56 animate-pulse rounded-2xl border border-line bg-card" />
        </div>
      </div>
    );
  }

  const totalTrendRev = d.trend.reduce((s, t) => s + t.revenue, 0);
  const maxRev = Math.max(1, ...d.trend.map((t) => t.revenue));

  const kpis = [
    { label: "Revenue", value: inr(d.revenue), icon: IndianRupee, note: "Confirmed & fulfilled" },
    { label: "Orders", value: String(d.orders), icon: ShoppingCart, note: `${d.unitsSold} units sold` },
    { label: "Avg. order value", value: inr(d.aov), icon: TrendingUp, note: "Per order" },
    { label: "Low stock", value: String(d.lowStock), icon: Boxes, note: "Variants ≤ 5" },
  ];

  const actions = [
    d.pending.returns > 0 && { href: "/admin/returns", label: `${d.pending.returns} return${d.pending.returns === 1 ? "" : "s"} to review`, icon: Undo2 },
    d.pending.reviews > 0 && { href: "/admin/reviews", label: `${d.pending.reviews} review${d.pending.reviews === 1 ? "" : "s"} pending`, icon: Star },
    d.lowStock > 0 && { href: "/admin/inventory", label: `${d.lowStock} low-stock variant${d.lowStock === 1 ? "" : "s"}`, icon: Boxes },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Undo2 }[];

  return (
    <div className="mb-8 space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-card p-5">
            <div className="flex items-center justify-between"><span className="text-xs font-medium uppercase tracking-wide text-muted">{k.label}</span><k.icon className="h-4 w-4 text-accent" /></div>
            <p className="mt-2 font-display text-2xl font-medium">{k.value}</p>
            <p className="mt-0.5 text-xs text-muted">{k.note}</p>
          </div>
        ))}
      </div>

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Link key={a.href} href={a.href} className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-400">
              <a.icon className="h-4 w-4" /> {a.label} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-line bg-card p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">Order pipeline</h3>
          <div className="flex gap-4 text-xs text-muted">
            <Link href="/admin/customers" className="hover:text-accent"><span className="font-medium text-ink">{d.customers}</span> customer{d.customers === 1 ? "" : "s"}</Link>
            <Link href="/admin/products" className="hover:text-accent"><span className="font-medium text-ink">{d.activeProducts}</span> active product{d.activeProducts === 1 ? "" : "s"}</Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {PIPELINE.map((s) => {
            const n = d.statusCounts[s] ?? 0;
            return (
              <Link key={s} href={`/admin/orders?status=${s}`} className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors", n > 0 ? "border-line hover:bg-accent-soft" : "border-line/60 text-muted/60")}>
                {ORDER_STATUS_LABEL[s]}
                <span className={cn("rounded-full px-1.5 text-[11px] font-semibold", n > 0 ? "bg-accent-soft text-accent" : "bg-black/5 text-muted dark:bg-white/10")}>{n}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h3 className="text-sm font-medium">Revenue · last 14 days</h3>
            {totalTrendRev > 0 && <span className="text-xs text-muted"><span className="font-semibold text-ink">{inr(totalTrendRev)}</span> · avg {inr(Math.round(totalTrendRev / 14))}/day</span>}
          </div>
          {totalTrendRev === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center text-sm text-muted">
              <TrendingUp className="mb-2 h-6 w-6 opacity-40" />
              No revenue in the last 14 days yet.<br />Your daily sales will chart here once orders come in.
            </div>
          ) : (
            <>
              <div className="flex h-40 items-end gap-1.5">
                {d.trend.map((t) => (
                  <div key={t.date} className="group flex flex-1 flex-col items-center justify-end" title={`${t.label}: ${inr(t.revenue)}`}>
                    <div className="w-full rounded-t bg-accent/80 transition-all group-hover:bg-accent" style={{ height: `${Math.round((t.revenue / maxRev) * 100)}%`, minHeight: t.revenue > 0 ? 4 : 0 }} />
                  </div>
                ))}
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-muted"><span>{d.trend[0]?.label}</span><span>{d.trend[d.trend.length - 1]?.label}</span></div>
            </>
          )}
        </div>

        <div className="rounded-2xl border border-line bg-card p-5">
          <h3 className="mb-3 text-sm font-medium">Top products</h3>
          {d.topProducts.length === 0 ? <p className="text-sm text-muted">No sales yet.</p> : (
            <ul className="space-y-1">
              {d.topProducts.map((p, i) => (
                <li key={p.productId}>
                  <Link href={`/admin/products/${p.productId}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent-soft/40">
                    <span className="w-4 shrink-0 text-center text-xs font-semibold text-muted">{i + 1}</span>
                    <span className="h-9 w-8 shrink-0 overflow-hidden rounded border border-line bg-accent-soft/30">{p.image && <img src={p.image} alt="" className="h-full w-full object-cover" />}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{p.name}<span className="block text-xs text-muted">{p.units} sold</span></span>
                    <span className="text-sm font-medium">{inr(p.revenue)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {d.recent.length > 0 && (
        <div className="rounded-2xl border border-line bg-card p-5">
          <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-medium">Recent orders</h3><Link href="/admin/orders" className="text-xs font-medium text-accent hover:underline">View all</Link></div>
          <div className="divide-y divide-line">
            {d.recent.map((o) => (
              <Link key={o.id} href={`/admin/orders?order=${o.id}`} className="grid grid-cols-[1fr_1.4fr_6rem_6.5rem] items-center gap-3 py-2.5 text-sm transition-colors hover:bg-accent-soft/30">
                <span><span className="font-medium">{o.orderNumber}</span><span className="block text-xs text-muted">{recentDate(o.createdAt)}</span></span>
                <span className="truncate text-muted">{o.customer}</span>
                <span className="text-right font-medium tabular-nums">{inr(o.total)}</span>
                <span className="flex justify-end"><OrderStatusBadge status={o.status as OrderStatus} /></span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
