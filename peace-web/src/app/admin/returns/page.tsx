"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, X, Check, Undo2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { PageHeader } from "@/components/admin/page-header";
import { SubNav, ORDER_TABS } from "@/components/admin/sub-nav";
import { EmptyState } from "@/components/admin/empty-state";
import { inr } from "@/lib/orders";
import { cn } from "@/lib/utils/cn";

type Status = "REQUESTED" | "APPROVED" | "REJECTED" | "COMPLETED";
interface Row {
  id: string; type: "RETURN" | "EXCHANGE"; reason: string; status: Status; resolution: string | null; refunded: boolean; createdAt: string;
  order: { orderNumber: string; total: number }; user: { name: string | null; email: string };
}
const STATUS_LABEL: Record<Status, string> = { REQUESTED: "To review", APPROVED: "Approved", REJECTED: "Rejected", COMPLETED: "Done" };
const TABS: { key: Status | ""; label: string }[] = [
  { key: "REQUESTED", label: "To review" }, { key: "COMPLETED", label: "Completed" }, { key: "REJECTED", label: "Rejected" }, { key: "", label: "All" },
];
const badge: Record<Status, string> = {
  REQUESTED: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
};

export default function ReturnsPage() {
  const { storeId, hasPermission } = useAdminAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState(0);
  const [tab, setTab] = useState<Status | "">("REQUESTED");
  const [loading, setLoading] = useState(true);
  const [resolve, setResolve] = useState<{ row: Row; action: "APPROVE" | "REJECT" } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const q = storeId ? `storeId=${storeId}` : "";
  const canUpdate = hasPermission("orders.update");

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const p = new URLSearchParams(q);
    if (tab) p.set("status", tab);
    try {
      const res = await api.get<{ items: Row[]; pendingCount: number }>(`/orders/admin/returns?${p}`, { auth: true });
      setRows(res.items); setPending(res.pendingCount);
    } finally { setLoading(false); }
  }, [storeId, q, tab]);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!resolve) return;
    setBusy(true);
    try { await api.patch(`/orders/admin/returns/${resolve.row.id}?${q}`, { action: resolve.action, resolution: note || undefined }, { auth: true }); setResolve(null); setNote(""); await load(); }
    finally { setBusy(false); }
  }

  return (
    <div className="w-full">
      <PageHeader title="Returns & exchanges" description={pending > 0 ? `${pending} awaiting review · Approve or reject the return & exchange requests customers raise from their delivered orders.` : "Approve or reject the return & exchange requests customers raise from their delivered orders."} />
      <SubNav tabs={ORDER_TABS} />

      <div className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key || "all"} onClick={() => setTab(t.key)} className={cn("rounded-full border px-4 py-1.5 text-sm", tab === t.key ? "border-accent bg-accent text-accent-foreground" : "border-line hover:bg-accent-soft")}>
            {t.label}{t.key === "REQUESTED" && pending > 0 && <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-xs text-white">{pending}</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>
      ) : !rows.length ? (
        <EmptyState icon={Undo2} title="No return requests" description="You're all caught up — return and exchange requests will show up here." />
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-line p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-sm font-medium"><Undo2 className="h-4 w-4 text-accent" /> {r.type === "RETURN" ? "Return" : "Exchange"}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", badge[r.status])}>{STATUS_LABEL[r.status]}</span>
                    {r.refunded && <span className="text-xs text-accent">Refunded</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted">Order <span className="font-medium text-ink">{r.order.orderNumber}</span> · {inr(r.order.total)} · {r.user.name ?? r.user.email} · {new Date(r.createdAt).toLocaleDateString("en-IN")}</p>
                </div>
                {canUpdate && r.status === "REQUESTED" && (
                  <div className="flex gap-2">
                    <button onClick={() => { setResolve({ row: r, action: "APPROVE" }); setNote(""); }} className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-400 dark:hover:bg-emerald-500/10"><Check className="h-3.5 w-3.5" /> Approve</button>
                    <button onClick={() => { setResolve({ row: r, action: "REJECT" }); setNote(""); }} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-accent-soft"><X className="h-3.5 w-3.5" /> Reject</button>
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm"><span className="text-muted">Reason:</span> {r.reason}</p>
              {r.resolution && <p className="mt-1 text-xs text-muted">Note: {r.resolution}</p>}
            </div>
          ))}
        </div>
      )}

      {resolve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/50" onClick={() => setResolve(null)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-2xl">
            <h3 className="font-display text-lg">{resolve.action === "APPROVE" ? "Approve return" : "Reject return"}</h3>
            <p className="mt-1 text-sm text-muted">{resolve.action === "APPROVE" ? "Stock will be restored and the payment flagged for refund." : "The customer will be notified it was declined."}</p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note to customer (optional)" className="mt-3 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent" />
            <div className="mt-4 flex gap-2">
              <button onClick={submit} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Confirm</button>
              <button onClick={() => setResolve(null)} className="rounded-full border border-line px-5 text-sm hover:bg-accent-soft">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
