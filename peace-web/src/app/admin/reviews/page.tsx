"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Check, X, Trash2, BadgeCheck, Star } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils/cn";

type Status = "PENDING" | "APPROVED" | "REJECTED";
interface Review {
  id: string; rating: number; title: string | null; comment: string | null; media: string[];
  status: Status; isVerifiedPurchase: boolean; helpfulCount: number; createdAt: string;
  user: { name: string | null; email: string }; product: { title: string; slug: string };
}
interface ListResp { items: Review[]; total: number; pendingCount: number }

const TABS: { key: Status | ""; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "", label: "All" },
];
const badge: Record<Status, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
};
const STATUS_LABEL: Record<Status, string> = { PENDING: "Awaiting approval", APPROVED: "Published", REJECTED: "Hidden" };

export default function ReviewsAdminPage() {
  const { storeId, hasPermission } = useAdminAuth();
  const confirm = useConfirm();
  const [rows, setRows] = useState<Review[]>([]);
  const [tab, setTab] = useState<Status | "">("PENDING");
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const q = storeId ? `storeId=${storeId}` : "";
  const canModerate = hasPermission("reviews.update");
  const canDelete = hasPermission("reviews.delete");

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const params = new URLSearchParams(q);
    if (tab) params.set("status", tab);
    params.set("limit", "50");
    try {
      const res = await api.get<ListResp>(`/reviews?${params}`, { auth: true });
      setRows(res.items);
      setPendingCount(res.pendingCount);
    } finally { setLoading(false); }
  }, [storeId, q, tab]);

  useEffect(() => { load(); }, [load]);

  async function moderate(r: Review, status: Status) {
    setBusy(r.id);
    try { await api.patch(`/reviews/${r.id}/status?${q}`, { status }, { auth: true }); await load(); }
    finally { setBusy(null); }
  }
  async function remove(r: Review) {
    const ok = await confirm({ title: "Delete review?", message: `Remove ${r.user.name ?? r.user.email}'s review of “${r.product.title}”. This cannot be undone.`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    setBusy(r.id);
    try { await api.delete(`/reviews/${r.id}?${q}`, { auth: true }); await load(); }
    finally { setBusy(null); }
  }

  return (
    <div className="w-full">
      <PageHeader title="Reviews" description={pendingCount > 0 ? `${pendingCount} awaiting approval · Approve reviews to publish them on the storefront, or hide the ones you don't want.` : "Approve reviews to publish them on the storefront, or hide the ones you don't want."} />

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn("rounded-full border px-4 py-1.5 text-sm transition-colors", tab === t.key ? "border-accent bg-accent text-accent-foreground" : "border-line hover:bg-accent-soft")}>
            {t.label}{t.key === "PENDING" && pendingCount > 0 && <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-xs text-white">{pendingCount}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Star} title="No reviews here" description="Customer reviews (buyers only) will appear here for you to approve." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <article key={r.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-0.5 text-sm font-medium">{r.rating}<Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" /></span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", badge[r.status])}>{STATUS_LABEL[r.status]}</span>
                    {r.isVerifiedPurchase && <span className="inline-flex items-center gap-0.5 text-xs text-accent"><BadgeCheck className="h-3.5 w-3.5" /> Verified</span>}
                  </div>
                  <p className="mt-1 truncate text-xs text-muted">on <span className="font-medium text-ink">{r.product.title}</span> · by {r.user.name ?? r.user.email} · {new Date(r.createdAt).toLocaleDateString("en-IN")}</p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {canModerate && r.status !== "APPROVED" && <button onClick={() => moderate(r, "APPROVED")} disabled={busy === r.id} className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:border-emerald-500/40 dark:text-emerald-400 dark:hover:bg-emerald-500/10"><Check className="h-3.5 w-3.5" /> Approve</button>}
                  {canModerate && r.status !== "REJECTED" && <button onClick={() => moderate(r, "REJECTED")} disabled={busy === r.id} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-accent-soft disabled:opacity-50"><X className="h-3.5 w-3.5" /> Reject</button>}
                  {canDelete && <button onClick={() => remove(r)} disabled={busy === r.id} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>}
                </div>
              </div>
              {r.title && <p className="mt-3 text-sm font-medium">{r.title}</p>}
              {r.comment && <p className="mt-1 text-sm text-muted">{r.comment}</p>}
              {r.media.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.media.map((m, i) => <a key={i} href={m} target="_blank" rel="noreferrer" className="h-16 w-16 overflow-hidden rounded-lg border border-line"><img src={m} alt="" className="h-full w-full object-cover" /></a>)}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
