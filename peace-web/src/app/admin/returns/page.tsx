"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, X, Check, Undo2, Truck, IndianRupee, Repeat } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { notifyOrdersChanged } from "@/lib/admin/events";
import { PageHeader } from "@/components/admin/page-header";
import { SubNav, ORDER_TABS } from "@/components/admin/sub-nav";
import { EmptyState } from "@/components/admin/empty-state";
import { inr } from "@/lib/orders";
import { cn } from "@/lib/utils/cn";

type Status = "REQUESTED" | "APPROVED" | "PICKED_UP" | "REFUNDED" | "EXCHANGED" | "REJECTED";
type Action = "APPROVE" | "REJECT" | "MARK_PICKED_UP" | "REFUND" | "COMPLETE_EXCHANGE";
type Pickup = "COURIER" | "SELF";
interface Row {
  id: string; type: "RETURN" | "EXCHANGE"; reason: string; status: Status; resolution: string | null; refunded: boolean; refundId: string | null;
  reverseAwb: string | null; createdAt: string;
  order: { id: string; orderNumber: string; total: number; paymentMethod: "COD" | "RAZORPAY"; paymentStatus: string };
  user: { name: string | null; email: string };
}
const STATUS_LABEL: Record<Status, string> = {
  REQUESTED: "To review", APPROVED: "Approved · awaiting pickup", PICKED_UP: "Picked up", REFUNDED: "Refunded", EXCHANGED: "Exchanged", REJECTED: "Rejected",
};
const TABS: { key: Status | ""; label: string }[] = [
  { key: "REQUESTED", label: "To review" }, { key: "APPROVED", label: "Awaiting pickup" }, { key: "PICKED_UP", label: "Picked up" },
  { key: "REFUNDED", label: "Refunded" }, { key: "EXCHANGED", label: "Exchanged" }, { key: "REJECTED", label: "Rejected" }, { key: "", label: "All" },
];
const badge: Record<Status, string> = {
  REQUESTED: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  APPROVED: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400",
  PICKED_UP: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400",
  REFUNDED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  EXCHANGED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  REJECTED: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-400",
};
const isOnlinePaid = (r: Row) => r.order.paymentMethod === "RAZORPAY" && r.order.paymentStatus === "PAID";

// Title, explanation, button and note rules for each step — the note is required where the server needs it.
function actionMeta(action: Action, r: Row): { title: string; desc: string; cta: string; notePlaceholder?: string; noteRequired?: boolean } {
  switch (action) {
    case "APPROVE":
      return { title: `Approve ${r.type === "RETURN" ? "return" : "exchange"}`, desc: "Choose how the item comes back to you. The customer is notified.", cta: "Approve", notePlaceholder: "Note to customer (optional)" };
    case "REJECT":
      return { title: "Reject request", desc: "The customer is told the request was declined.", cta: "Reject", notePlaceholder: "Reason shown to the customer (optional)" };
    case "MARK_PICKED_UP":
      return { title: "Mark as picked up", desc: "Confirm the item has been collected from the customer.", cta: "Mark picked up" };
    case "REFUND":
      return isOnlinePaid(r)
        ? { title: `Refund ${inr(r.order.total)}`, desc: "Refunded through Razorpay to the customer's original payment method. Stock is restored and the order is marked Returned.", cta: "Refund now" }
        : { title: `Record COD refund of ${inr(r.order.total)}`, desc: "Cash on Delivery orders are refunded by you (UPI / bank transfer). Pay the customer first, then record how you paid.", cta: "Record refund", notePlaceholder: "How you paid, e.g. UPI ref 4123…", noteRequired: true };
    case "COMPLETE_EXCHANGE":
      return { title: "Complete exchange", desc: "Send the replacement, then record it here. Adjust stock for the replacement item in Inventory.", cta: "Complete exchange", notePlaceholder: "Replacement item, courier and tracking number", noteRequired: true };
  }
}

export default function ReturnsPage() {
  const { storeId, hasPermission } = useAdminAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState(0);
  const [tab, setTab] = useState<Status | "">("REQUESTED");
  const [loading, setLoading] = useState(true);
  const [resolve, setResolve] = useState<{ row: Row; action: Action } | null>(null);
  const [note, setNote] = useState("");
  const [pickup, setPickup] = useState<Pickup>("COURIER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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

  function startAction(row: Row, action: Action) {
    setResolve({ row, action }); setNote(""); setError(""); setPickup("COURIER");
  }

  async function submit() {
    if (!resolve) return;
    setBusy(true); setError("");
    try {
      await api.patch(
        `/orders/admin/returns/${resolve.row.id}?${q}`,
        { action: resolve.action, resolution: note.trim() || undefined, ...(resolve.action === "APPROVE" && { pickup }) },
        { auth: true },
      );
      setResolve(null); setNote(""); await load(); notifyOrdersChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setBusy(false); }
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
                  <p className="mt-1 text-xs text-muted">
                    Order <Link href={`/admin/orders?order=${r.order.id}`} className="font-medium text-ink hover:text-accent">{r.order.orderNumber}</Link> · {inr(r.order.total)} · {r.order.paymentMethod === "COD" ? "COD" : "Prepaid"} · {r.user.name ?? r.user.email} · {new Date(r.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
                {canUpdate && (
                  <div className="flex gap-2">
                    {r.status === "REQUESTED" && <>
                      <button onClick={() => startAction(r, "APPROVE")} className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-400 dark:hover:bg-emerald-500/10"><Check className="h-3.5 w-3.5" /> Approve</button>
                      <button onClick={() => startAction(r, "REJECT")} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium hover:bg-accent-soft"><X className="h-3.5 w-3.5" /> Reject</button>
                    </>}
                    {r.status === "APPROVED" && <button onClick={() => startAction(r, "MARK_PICKED_UP")} className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-50 dark:border-indigo-500/40 dark:text-indigo-400 dark:hover:bg-indigo-500/10"><Truck className="h-3.5 w-3.5" /> Mark picked up</button>}
                    {r.status === "PICKED_UP" && r.type === "RETURN" && <button onClick={() => startAction(r, "REFUND")} className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90"><IndianRupee className="h-3.5 w-3.5" /> {isOnlinePaid(r) ? "Refund" : "Record COD refund"}</button>}
                    {r.status === "PICKED_UP" && r.type === "EXCHANGE" && <button onClick={() => startAction(r, "COMPLETE_EXCHANGE")} className="inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90"><Repeat className="h-3.5 w-3.5" /> Complete exchange</button>}
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm"><span className="text-muted">Reason:</span> {r.reason}</p>
              {r.resolution && <p className="mt-1 text-xs text-muted">Note: {r.resolution}</p>}
              {r.reverseAwb && <p className="mt-1 text-xs text-muted">Pickup AWB: <span className="font-mono">{r.reverseAwb}</span></p>}
              {r.refundId && <p className="mt-1 text-xs text-muted">Refund id: <span className="font-mono">{r.refundId}</span></p>}
            </div>
          ))}
        </div>
      )}

      {resolve && (() => {
        const meta = actionMeta(resolve.action, resolve.row);
        const blocked = busy || (meta.noteRequired && !note.trim());
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button className="absolute inset-0 bg-black/50" onClick={() => setResolve(null)} aria-label="Close" />
            <div className="relative w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-2xl">
              <h3 className="font-display text-lg">{meta.title}</h3>
              <p className="mt-1 text-sm text-muted">{meta.desc}</p>
              {resolve.action === "APPROVE" && (
                <div className="mt-3 grid gap-2">
                  {([["COURIER", "Book BharatShip pickup", "Courier collects the item from the customer's address"], ["SELF", "Arrange pickup yourself", "Customer sends it back, or you collect it"]] as const).map(([key, label, hint]) => (
                    <button key={key} type="button" onClick={() => setPickup(key)} className={cn("rounded-xl border p-3 text-left text-sm", pickup === key ? "border-accent bg-accent-soft/40" : "border-line hover:bg-accent-soft/30")}>
                      <span className="font-medium">{label}</span>
                      <span className="block text-xs text-muted">{hint}</span>
                    </button>
                  ))}
                </div>
              )}
              {meta.notePlaceholder && (
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder={meta.notePlaceholder} className="mt-3 w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent" />
              )}
              {error && <p className="mt-3 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
              <div className="mt-4 flex gap-2">
                <button onClick={submit} disabled={blocked} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} {meta.cta}</button>
                <button onClick={() => setResolve(null)} className="rounded-full border border-line px-5 text-sm hover:bg-accent-soft">Close</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
