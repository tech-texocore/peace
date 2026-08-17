"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, FileText, MapPin, Package, XCircle, RotateCcw, X } from "lucide-react";
import { getMyOrder, cancelOrder, requestReturn, inr, ORDER_STATUS_LABEL, type Order } from "@/lib/orders";
import { OrderStatusBadge } from "@/components/store/order-status-badge";
import { useConfirm } from "@/components/ui/confirm-dialog";

const CANCELLABLE = ["PENDING", "CONFIRMED", "PACKED"];
const RETURN_STEPS = [
  { key: "REQUESTED", label: "Return requested" },
  { key: "APPROVED", label: "Approved — pickup scheduled" },
  { key: "PICKED_UP", label: "Item collected" },
  { key: "REFUNDED", label: "Refund initiated" },
];
const returnStepIndex = (s: string): number => ({ REQUESTED: 0, APPROVED: 1, PICKED_UP: 2, REFUNDED: 3 } as Record<string, number>)[s] ?? 0;

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const placed = useSearchParams().get("placed") === "1";
  const confirm = useConfirm();
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnType, setReturnType] = useState<"RETURN" | "EXCHANGE">("RETURN");
  const [returnReason, setReturnReason] = useState("");
  const [returnDone, setReturnDone] = useState(false);
  const [returnErr, setReturnErr] = useState("");

  const load = () => getMyOrder(id).then(setOrder).catch(() => setNotFound(true));
  useEffect(() => { load(); }, [id]);

  async function submitReturn() {
    if (returnReason.trim().length < 3) { setReturnErr("Please tell us why"); return; }
    setBusy(true); setReturnErr("");
    try { await requestReturn(id, returnType, returnReason.trim()); setReturnDone(true); }
    catch (e) { setReturnErr(e instanceof Error ? e.message : "Could not submit"); }
    finally { setBusy(false); }
  }

  async function doCancel() {
    const ok = await confirm({ title: "Cancel this order?", message: "Your items will be released and any payment refunded.", confirmLabel: "Cancel order", danger: true });
    if (!ok) return;
    setBusy(true);
    try { await cancelOrder(id); await load(); } finally { setBusy(false); }
  }

  if (notFound) return <div className="rounded-2xl border border-dashed border-line py-16 text-center text-sm text-muted">Order not found.</div>;
  if (!order) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;

  const addr = order.shippingAddress;

  return (
    <div className="space-y-5">
      {placed && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 className="h-6 w-6 shrink-0" />
          <div><p className="font-medium">Order placed successfully!</p><p className="text-sm">We’ll send updates as it progresses.</p></div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/account/orders" className="text-xs text-muted hover:text-accent">← All orders</Link>
          <h1 className="mt-1 flex items-center gap-2 font-display text-2xl font-medium">{order.orderNumber} <OrderStatusBadge status={order.status} /></h1>
          <p className="mt-0.5 text-sm text-muted">
            Placed {new Date(order.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            {order.estimatedDelivery && order.status !== "CANCELLED" && ` · Est. delivery ${new Date(order.estimatedDelivery).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href={`/account/orders/${order.id}/invoice`} className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-accent-soft"><FileText className="h-4 w-4" /> Invoice</Link>
          {order.status === "DELIVERED" && (!order.returnRequest || order.returnRequest.status === "REJECTED") && (
            <button onClick={() => { setReturnOpen(true); setReturnDone(false); setReturnReason(""); setReturnErr(""); }} className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-medium hover:bg-accent-soft"><RotateCcw className="h-4 w-4" /> Return / Exchange</button>
          )}
          {CANCELLABLE.includes(order.status) && (
            <button onClick={doCancel} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-50"><XCircle className="h-4 w-4" /> Cancel</button>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* Timeline */}
          {order.events && order.events.length > 0 && (
            <section className="rounded-2xl border border-line p-5">
              <h2 className="mb-4 flex items-center gap-2 font-medium"><Package className="h-5 w-5 text-accent" /> Tracking</h2>
              <ol className="space-y-4">
                {order.events.map((e, i) => (
                  <li key={e.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className={`h-3 w-3 rounded-full ${i === (order.events!.length - 1) ? "bg-accent" : "bg-line"}`} />
                      {i < order.events!.length - 1 && <span className="w-px flex-1 bg-line" />}
                    </div>
                    <div className="-mt-1 pb-1">
                      <p className="text-sm font-medium">{ORDER_STATUS_LABEL[e.status]}</p>
                      {e.note && <p className="text-xs text-muted">{e.note}</p>}
                      <p className="text-xs text-muted">{new Date(e.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {order.returnRequest && (
            <section className="rounded-2xl border border-line p-5">
              <h2 className="mb-1 flex items-center gap-2 font-medium"><RotateCcw className="h-5 w-5 text-accent" /> {order.returnRequest.type === "EXCHANGE" ? "Exchange" : "Return"} status</h2>
              <p className="mb-4 text-xs text-muted">Reason: {order.returnRequest.reason}</p>
              {order.returnRequest.status === "REJECTED" ? (
                <p className="text-sm text-danger">Your request was declined.{order.returnRequest.resolution ? ` ${order.returnRequest.resolution}` : ""}</p>
              ) : (
                <ol className="space-y-4">
                  {RETURN_STEPS.map((step, i) => {
                    const reached = returnStepIndex(order.returnRequest!.status) >= i;
                    return (
                      <li key={step.key} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className={`h-3 w-3 rounded-full ${reached ? "bg-accent" : "bg-line"}`} />
                          {i < RETURN_STEPS.length - 1 && <span className={`w-px flex-1 ${reached ? "bg-accent/40" : "bg-line"}`} />}
                        </div>
                        <p className={`-mt-1 pb-1 text-sm ${reached ? "font-medium" : "text-muted"}`}>{step.label}</p>
                      </li>
                    );
                  })}
                </ol>
              )}
              {order.returnRequest.refundAmount != null && <p className="mt-3 text-xs text-muted">Refund amount: <span className="font-medium text-ink">{inr(order.returnRequest.refundAmount)}</span>{order.returnRequest.refundId ? ` · ref ${order.returnRequest.refundId}` : ""}</p>}
            </section>
          )}

          {/* Items */}
          <section className="rounded-2xl border border-line p-5">
            <h2 className="mb-3 font-medium">Items</h2>
            <div className="divide-y divide-line">
              {order.items.map((it, i) => (
                <div key={i} className="flex gap-3 py-3">
                  <span className="h-16 w-12 shrink-0 overflow-hidden rounded-lg border border-line bg-accent-soft/30">{it.image && <img src={it.image} alt="" className="h-full w-full object-cover" />}</span>
                  <div className="flex-1 text-sm">
                    <p className="font-medium">{it.name}</p>
                    {it.sku && <p className="text-xs text-muted">{it.sku}</p>}
                    <p className="text-xs text-muted">Qty {it.quantity}</p>
                    {it.customization && Object.keys(it.customization).length > 0 && (
                      <p className="mt-0.5 text-xs text-muted">{Object.entries(it.customization).map(([k, v]) => `${k}: ${v}`).join(", ")}</p>
                    )}
                  </div>
                  <p className="text-sm font-medium">{inr((it.price ?? 0) * it.quantity)}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-line p-5">
            <h2 className="mb-2 flex items-center gap-2 font-medium"><MapPin className="h-5 w-5 text-accent" /> Delivery address</h2>
            <p className="text-sm"><span className="font-medium">{addr.recipientName}</span> · {addr.recipientPhone}</p>
            <p className="mt-0.5 text-sm text-muted">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}, {addr.state} — {addr.postalCode}</p>
          </section>

          <section className="rounded-2xl border border-line p-5 text-sm">
            <h2 className="mb-3 font-medium">Payment summary</h2>
            <div className="space-y-1.5">
              <Row label="Subtotal" value={inr(order.subtotal)} />
              {order.discount > 0 && <Row label={`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`} value={`− ${inr(order.discount)}`} accent />}
              <Row label="Delivery" value={order.shippingFee === 0 ? "FREE" : inr(order.shippingFee)} />
              <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><span>Total</span><span>{inr(order.total)}</span></div>
              {order.taxAmount > 0 && <p className="text-xs text-muted">Incl. GST {inr(order.taxAmount)}</p>}
            </div>
            <p className="mt-3 text-xs text-muted">{order.paymentMethod === "COD" ? "Cash on Delivery" : "Prepaid"} · {order.paymentStatus}</p>
          </section>
        </aside>
      </div>

      {returnOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/50" onClick={() => setReturnOpen(false)} aria-label="Close" />
          <div className="relative w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-lg"><RotateCcw className="h-5 w-5 text-accent" /> Return / Exchange</h3>
              <button onClick={() => setReturnOpen(false)} className="rounded-lg p-1.5 text-muted hover:bg-accent-soft"><X className="h-5 w-5" /></button>
            </div>
            {returnDone ? (
              <div className="py-6 text-center">
                <CheckCircle2 className="mx-auto h-9 w-9 text-accent" />
                <p className="mt-2 text-sm">Your request has been submitted. We’ll review it and email you an update.</p>
                <button onClick={() => setReturnOpen(false)} className="mt-4 rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-foreground">Done</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  {(["RETURN", "EXCHANGE"] as const).map((t) => (
                    <button key={t} onClick={() => setReturnType(t)} className={`flex-1 rounded-lg border px-3 py-2 text-sm ${returnType === t ? "border-accent bg-accent-soft/40 font-medium" : "border-line hover:bg-accent-soft/30"}`}>{t === "RETURN" ? "Return" : "Exchange"}</button>
                  ))}
                </div>
                <textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} rows={3} placeholder="Reason (e.g. size doesn’t fit, defective)" className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent" />
                {returnErr && <p className="text-sm text-danger">{returnErr}</p>}
                <button onClick={submitReturn} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Submit request</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className="flex justify-between"><span className="text-muted">{label}</span><span className={accent ? "font-medium text-accent" : ""}>{value}</span></div>;
}
