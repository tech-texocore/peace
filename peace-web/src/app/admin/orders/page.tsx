"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, Search, X, ChevronRight, ChevronDown, ShoppingCart, MapPin, Phone, Mail, Truck, CreditCard, Package, Clock } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { notifyOrdersChanged } from "@/lib/admin/events";
import { cn } from "@/lib/utils/cn";
import { OrderStatusBadge } from "@/components/store/order-status-badge";
import { PageHeader } from "@/components/admin/page-header";
import { SubNav, ORDER_TABS } from "@/components/admin/sub-nav";
import { EmptyState } from "@/components/admin/empty-state";
import { useSort, SortTh } from "@/components/admin/sortable";
import { inr, ORDER_STATUS_LABEL, type Order, type OrderStatus, type TrackingResult } from "@/lib/orders";
import { CustomizationSummary } from "@/components/ui/customization-summary";

type Customer = { name: string | null; email: string; phone: string | null };
type AdminOrder = Order & {
  customer: string | Customer;
  allowedStatuses?: OrderStatus[];
  courierConnected?: boolean;
  paymentWindowMinutes?: number;
};
type ManualShipment = { courierName: string; awb: string };

const PAY_LABEL: Record<string, string> = { UNPAID: "Not paid", PENDING: "Payment pending", PAID: "Paid", REFUNDED: "Refunded", FAILED: "Payment failed" };
const PAY_TONE: Record<string, string> = { PAID: "text-emerald-600 dark:text-emerald-400", REFUNDED: "text-muted", FAILED: "text-danger", PENDING: "text-amber-600 dark:text-amber-400", UNPAID: "text-muted" };
interface ListResp { items: AdminOrder[]; total: number; statusCounts: Record<string, number> }

const TABS: (OrderStatus | "")[] = ["", "PENDING", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED", "RETURNED"];
const PAY_METHODS: [string, string][] = [["", "All payments"], ["COD", "Cash on delivery"], ["RAZORPAY", "Prepaid / online"]];
const PAY_STATUSES: [string, string][] = [["", "Any payment status"], ["PAID", "Paid"], ["UNPAID", "Not paid"], ["PENDING", "Payment pending"], ["REFUNDED", "Refunded"], ["FAILED", "Failed"]];

const dateTime = (s: string) => new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const dateShort = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 appearance-none rounded-full border border-line bg-card pl-4 pr-9 text-sm outline-none focus:border-accent">{children}</select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

export default function AdminOrdersPage() {
  return <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>}><OrdersInner /></Suspense>;
}

function OrdersInner() {
  const { storeId, hasPermission } = useAdminAuth();
  const confirm = useConfirm();
  const [rows, setRows] = useState<AdminOrder[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [tab, setTab] = useState<OrderStatus | "">("");
  const [search, setSearch] = useState("");
  const [payMethod, setPayMethod] = useState("");
  const [payStatus, setPayStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<AdminOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [actionErr, setActionErr] = useState("");

  const q = storeId ? `storeId=${storeId}` : "";
  const canUpdate = hasPermission("orders.update");
  const { sort, toggle, apply } = useSort();
  const hasFilters = !!(search || payMethod || payStatus || from || to);
  const sp = useSearchParams();
  const deepLinkId = sp.get("order");
  const statusParam = sp.get("status");

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const params = new URLSearchParams(q);
    if (tab) params.set("status", tab);
    if (search) params.set("search", search);
    if (payMethod) params.set("paymentMethod", payMethod);
    if (payStatus) params.set("paymentStatus", payStatus);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("limit", "100");
    try {
      const res = await api.get<ListResp>(`/orders/admin/list?${params}`, { auth: true });
      setRows(res.items); setCounts(res.statusCounts);
    } finally { setLoading(false); }
  }, [storeId, q, tab, search, payMethod, payStatus, from, to]);

  useEffect(() => { load(); }, [load]);

  const openDetail = useCallback(async (id: string) => {
    const o = await api.get<AdminOrder>(`/orders/admin/${id}?${q}`, { auth: true });
    setDetail(o); setNote(""); setActionErr("");
  }, [q]);

  useEffect(() => { if (deepLinkId && storeId) openDetail(deepLinkId); }, [deepLinkId, storeId, openDetail]);
  useEffect(() => { if (statusParam && TABS.includes(statusParam as OrderStatus)) setTab(statusParam as OrderStatus); }, [statusParam]);

  async function setStatus(status: OrderStatus, shipment?: ManualShipment) {
    if (!detail) return;
    if (status === "CANCELLED") {
      const ok = await confirm({ title: `Cancel ${detail.orderNumber}?`, message: cancelMessage(detail), confirmLabel: "Cancel order", danger: true });
      if (!ok) return;
    }
    if (status === "DELIVERED" && detail.paymentMethod === "COD") {
      const ok = await confirm({ title: "Mark as delivered?", message: `This also records the Cash on Delivery payment of ${inr(detail.total)} as received.`, confirmLabel: "Mark delivered" });
      if (!ok) return;
    }
    setBusy(true); setActionErr("");
    try {
      await api.patch(`/orders/admin/${detail.id}/status?${q}`, { status, note: note.trim() || undefined, ...shipment }, { auth: true });
      await openDetail(detail.id); await load(); notifyOrdersChanged();
    } catch (e) {
      setActionErr(e instanceof Error ? e.message : "Could not update the order");
    } finally { setBusy(false); }
  }

  async function ship() {
    if (!detail) return;
    setBusy(true); setActionErr("");
    try { await api.post(`/orders/admin/${detail.id}/ship?${q}`, {}, { auth: true }); await openDetail(detail.id); await load(); notifyOrdersChanged(); }
    catch (e) { setActionErr(e instanceof Error ? e.message : "Could not create shipment"); }
    finally { setBusy(false); }
  }
  const track = (oid: string) => api.get<TrackingResult>(`/orders/admin/${oid}/tracking?${q}`, { auth: true });

  function clearFilters() { setSearch(""); setPayMethod(""); setPayStatus(""); setFrom(""); setTo(""); }

  const customerName = (c: AdminOrder["customer"]) => (typeof c === "string" ? c : c.name ?? c.email);
  const location = (o: AdminOrder) => (o.shippingAddress ? [o.shippingAddress.city, o.shippingAddress.state].filter(Boolean).join(", ") : "");
  const shown = apply(rows, { order: (o) => o.createdAt, customer: (o) => customerName(o.customer), place: (o) => location(o), items: (o) => o.items.length, total: (o) => o.total, payment: (o) => o.paymentStatus, status: (o) => o.status });
  const viewTotal = shown.reduce((s, o) => s + o.total, 0);

  return (
    <div className="w-full">
      <PageHeader title="Orders" description="Every order placed on your store. Filter, then open one to see the full detail and move it from placed to delivered." />
      <SubNav tabs={ORDER_TABS} />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button key={t || "all"} onClick={() => setTab(t)} className={cn("rounded-full border px-3.5 py-1.5 text-sm transition-colors", tab === t ? "border-accent bg-accent text-accent-foreground" : "border-line hover:bg-accent-soft")}>
            {t ? ORDER_STATUS_LABEL[t] : "All"}{t && counts[t] ? <span className="ml-1.5 text-xs opacity-70">{counts[t]}</span> : null}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order # or customer" className="h-9 w-56 rounded-full border border-line bg-canvas pl-9 pr-3 text-sm outline-none focus:border-accent" />
        </div>
        <Select value={payMethod} onChange={setPayMethod}>{PAY_METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        <Select value={payStatus} onChange={setPayStatus}>{PAY_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
        <label className="flex items-center gap-1.5 text-xs text-muted">From
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 rounded-full border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-accent" />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-muted">To
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 rounded-full border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-accent" />
        </label>
        {hasFilters && <button onClick={clearFilters} className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:bg-accent-soft">Clear</button>}
        {!loading && <span className="ml-auto text-sm text-muted">{shown.length} order{shown.length === 1 ? "" : "s"} · <span className="font-medium text-ink">{inr(viewTotal)}</span></span>}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>
      ) : shown.length === 0 ? (
        <EmptyState icon={ShoppingCart} title={tab || hasFilters ? "No matching orders" : "No orders yet"} description={tab || hasFilters ? "Try a different status, date range, or search." : "New orders from your store will appear here automatically."} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-accent-soft/40 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <SortTh label="Order" sortKey="order" sort={sort} onSort={toggle} className="px-4 py-3" />
                <SortTh label="Customer" sortKey="customer" sort={sort} onSort={toggle} className="px-4 py-3" />
                <SortTh label="Deliver to" sortKey="place" sort={sort} onSort={toggle} className="px-4 py-3" />
                <SortTh label="Items" sortKey="items" sort={sort} onSort={toggle} className="px-4 py-3" />
                <SortTh label="Total" sortKey="total" sort={sort} onSort={toggle} className="px-4 py-3" />
                <SortTh label="Payment" sortKey="payment" sort={sort} onSort={toggle} className="px-4 py-3" />
                <SortTh label="Status" sortKey="status" sort={sort} onSort={toggle} className="px-4 py-3" />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map((o) => (
                <tr key={o.id} onClick={() => openDetail(o.id)} className="cursor-pointer border-t border-line hover:bg-accent-soft/30">
                  <td className="px-4 py-3"><span className="font-medium">{o.orderNumber}</span><span className="block text-xs text-muted">{dateShort(o.createdAt)}</span></td>
                  <td className="px-4 py-3">{customerName(o.customer)}</td>
                  <td className="px-4 py-3 text-muted">{location(o) || "—"}</td>
                  <td className="px-4 py-3">{o.items.length}</td>
                  <td className="px-4 py-3 font-medium">{inr(o.total)}</td>
                  <td className="px-4 py-3 text-xs"><span className="text-muted">{o.paymentMethod === "COD" ? "COD" : "Prepaid"}</span> · <span className={PAY_TONE[o.paymentStatus] ?? "text-muted"}>{PAY_LABEL[o.paymentStatus] ?? o.paymentStatus}</span></td>
                  <td className="px-4 py-3"><OrderStatusBadge status={o.status} /></td>
                  <td className="px-4 py-3 text-muted"><ChevronRight className="h-4 w-4" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && <OrderDrawer order={detail} onClose={() => setDetail(null)} canUpdate={canUpdate} busy={busy} note={note} setNote={setNote} setStatus={setStatus} ship={ship} track={track} actionErr={actionErr} />}
    </div>
  );
}

function cancelMessage(o: AdminOrder) {
  const steps = ["Stock goes back to inventory."];
  if (o.paymentMethod === "RAZORPAY" && o.paymentStatus === "PAID") steps.unshift(`${inr(o.total)} will be refunded to the customer through Razorpay.`);
  if (o.shipmentProvider === "bharatship" && o.awb) steps.unshift(`The BharatShip shipment ${o.awb} will be cancelled.`);
  if (o.shipmentProvider === "manual" && o.awb) steps.unshift(`Also stop the ${o.courierName ?? "courier"} shipment ${o.awb} yourself.`);
  return `${steps.join(" ")} The customer is notified.`;
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={cn("flex justify-between", strong ? "font-semibold" : "text-muted")}><span>{label}</span><span className={strong ? "" : "text-ink"}>{value}</span></div>;
}

function OrderDrawer({ order, onClose, canUpdate, busy, note, setNote, setStatus, ship, track, actionErr }: {
  order: AdminOrder; onClose: () => void; canUpdate: boolean; busy: boolean; note: string; setNote: (v: string) => void; setStatus: (s: OrderStatus) => void;
  ship: () => void; track: (oid: string) => Promise<TrackingResult>; actionErr: string;
}) {
  const c = typeof order.customer === "string" ? { name: order.customer, email: "", phone: "" } : order.customer;
  const [trk, setTrk] = useState<TrackingResult | null>(null);
  const [trkBusy, setTrkBusy] = useState(false);
  const doTrack = async () => { setTrkBusy(true); try { setTrk(await track(order.id)); } catch (e) { setTrk({ awb: order.awb ?? "", status: e instanceof Error ? e.message : "Tracking unavailable", events: [] }); } finally { setTrkBusy(false); } };
  const a = order.shippingAddress;
  const events = order.events ?? [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="flex h-full w-full max-w-3xl flex-col bg-canvas" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-lg leading-tight">{order.orderNumber}</h2>
            <p className="text-xs text-muted">{dateTime(order.createdAt)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-accent-soft"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={order.status} />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-muted"><CreditCard className="h-3.5 w-3.5" />{order.paymentMethod === "COD" ? "Cash on delivery" : "Prepaid"} · {PAY_LABEL[order.paymentStatus] ?? order.paymentStatus}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 md:items-start">
            <div className="space-y-4">
              <div className="rounded-xl border border-line bg-card p-3 text-sm">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Customer</p>
                <p className="font-medium">{c.name ?? "Guest"}</p>
                <div className="mt-1 space-y-0.5 text-xs text-muted">
                  {c.email && <p className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{c.email}</p>}
                  {c.phone && <p className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{c.phone}</p>}
                </div>
              </div>

              <div className="rounded-xl border border-line bg-card p-3 text-sm">
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><MapPin className="h-3.5 w-3.5" />Deliver to</p>
                <p className="font-medium">{a.recipientName} · {a.recipientPhone}</p>
                <p className="text-muted">{a.line1}{a.line2 ? `, ${a.line2}` : ""}{a.landmark ? `, ${a.landmark}` : ""}, {a.city}, {a.state} — {a.postalCode}</p>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><Truck className="h-3.5 w-3.5" />{order.deliveryMethod || "Standard"}{order.estimatedDelivery ? ` · est. ${dateShort(order.estimatedDelivery)}` : ""}</p>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><Package className="h-3.5 w-3.5" />Items ({order.items.length})</p>
                <div className="divide-y divide-line rounded-xl border border-line bg-card">
                  {order.items.map((it, i) => {
                    const unit = it.price ?? 0;
                    const inner = (
                      <>
                        <span className="h-14 w-11 shrink-0 overflow-hidden rounded-lg border border-line bg-accent-soft/30">{it.image && <img src={it.image} alt="" className="h-full w-full object-cover" />}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium leading-tight">{it.name}</p>
                          {it.sku && <p className="text-xs text-muted">SKU {it.sku}</p>}
                          <p className="mt-0.5 text-xs text-muted">{it.quantity} × {inr(unit)}{it.mrp && it.mrp > unit ? <span className="ml-1 line-through">{inr(it.mrp)}</span> : null}</p>
                        </div>
                        <span className="font-medium">{inr(unit * it.quantity)}</span>
                      </>
                    );
                    return (
                      <div key={it.id ?? i}>
                        {it.productId ? (
                          <Link href={`/admin/products/${it.productId}`} className="flex gap-3 p-3 text-sm transition-colors hover:bg-accent-soft/40">{inner}</Link>
                        ) : (
                          <div className="flex gap-3 p-3 text-sm">{inner}</div>
                        )}
                        <CustomizationSummary values={it.customization} className="-mt-2 space-y-1 px-3 pb-3 pl-[4.25rem] text-xs text-muted" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1 rounded-xl border border-line bg-card p-3 text-sm">
                <Row label="Subtotal" value={inr(order.subtotal)} />
                {order.discount > 0 && <div className="flex justify-between text-accent"><span>Discount{order.couponCode ? ` · ${order.couponCode}` : ""}</span><span>− {inr(order.discount)}</span></div>}
                {order.taxAmount > 0 && <Row label="Tax" value={inr(order.taxAmount)} />}
                <Row label="Delivery" value={order.shippingFee === 0 ? "FREE" : inr(order.shippingFee)} />
                <div className="mt-1 border-t border-line pt-1.5"><Row label="Total" value={inr(order.total)} strong /></div>
              </div>

              {order.notes && <div className="rounded-xl border border-line bg-card p-3 text-sm"><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Customer note</p><p className="text-muted">{order.notes}</p></div>}

              {events.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><Clock className="h-3.5 w-3.5" />Timeline</p>
                  <ol className="space-y-3 rounded-xl border border-line bg-card p-3">
                    {events.map((e, i) => (
                      <li key={e.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className={cn("mt-1 h-2 w-2 rounded-full", i === events.length - 1 ? "bg-accent" : "bg-line")} />
                          {i < events.length - 1 && <span className="mt-1 w-px flex-1 bg-line" />}
                        </div>
                        <div className="-mt-0.5 pb-0.5">
                          <p className="text-sm font-medium">{ORDER_STATUS_LABEL[e.status] ?? e.status}</p>
                          {e.note && <p className="text-xs text-muted">{e.note}</p>}
                          <p className="text-[11px] text-muted/70">{dateTime(e.createdAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>

        {order.awb && (
          <div className="border-t border-line px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm"><Truck className="mr-1.5 inline h-4 w-4 text-accent" />{order.courierName ? `${order.courierName} · ` : ""}AWB <span className="font-mono">{order.awb}</span></p>
              {order.shipmentProvider === "bharatship"
                ? <button onClick={doTrack} disabled={trkBusy} className="rounded-full border border-line px-3 py-1.5 text-xs font-medium hover:bg-accent-soft disabled:opacity-50">{trkBusy ? "Tracking…" : "Track"}</button>
                : <span className="text-xs text-muted">Shipped manually</span>}
            </div>
            {trk && <p className="mt-2 text-xs text-muted">Status: <span className="text-ink">{trk.status}</span>{trk.events[0]?.location ? ` · ${trk.events[0].location}` : ""}</p>}
          </div>
        )}

        {canUpdate && (
          <OrderActions order={order} busy={busy} note={note} setNote={setNote} setStatus={setStatus} ship={ship} actionErr={actionErr} />
        )}
      </div>
    </div>
  );
}


function OrderActions({ order, busy, note, setNote, setStatus, ship, actionErr }: {
  order: AdminOrder; busy: boolean; note: string; setNote: (v: string) => void;
  setStatus: (s: OrderStatus, shipment?: ManualShipment) => void; ship: () => void; actionErr: string;
}) {
  const allowed = order.allowedStatuses ?? [];
  const canShip = allowed.includes("SHIPPED");
  const [manual, setManual] = useState(!order.courierConnected);
  const [shipment, setShipment] = useState<ManualShipment>({ courierName: "", awb: "" });
  const manualReady = shipment.courierName.trim() && shipment.awb.trim();

  if (!allowed.length) {
    return (
      <div className="border-t border-line px-5 py-4 text-sm text-muted">
        {order.status === "DELIVERED"
          ? <>Delivered — returns and exchanges are handled in <Link href="/admin/returns" className="text-accent hover:underline">Returns</Link>.</>
          : `This order is ${ORDER_STATUS_LABEL[order.status].toLowerCase()} — no further changes.`}
      </div>
    );
  }

  const btn = "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold disabled:opacity-50";
  const primary = cn(btn, "bg-accent text-accent-foreground hover:opacity-90");
  const outline = cn(btn, "border border-line font-medium hover:bg-accent-soft");

  return (
    <div className="space-y-3 border-t border-line px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">Next step</p>
        <p className="text-xs text-muted">{STEP_HINT[order.status]?.(order)}</p>
      </div>

      {canShip && (
        <div className="rounded-xl border border-line bg-card p-3">
          {!manual ? (
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={ship} disabled={busy} className={primary}><Truck className="h-3.5 w-3.5" /> Ship with BharatShip</button>
              <button type="button" onClick={() => setManual(true)} className="text-xs text-muted hover:text-accent">Shipped another way?</button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted">{order.courierConnected ? "Shipping without BharatShip — enter the courier details the customer will see." : "BharatShip is not connected — enter the courier details the customer will see."}</p>
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <input value={shipment.courierName} onChange={(e) => setShipment({ ...shipment, courierName: e.target.value })} placeholder="Courier (e.g. DTDC, India Post)" maxLength={60} className="h-9 rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" />
                <input value={shipment.awb} onChange={(e) => setShipment({ ...shipment, awb: e.target.value })} placeholder="Tracking number" maxLength={60} className="h-9 rounded-lg border border-line bg-canvas px-3 font-mono text-sm outline-none focus:border-accent" />
                <button onClick={() => setStatus("SHIPPED", { courierName: shipment.courierName.trim(), awb: shipment.awb.trim() })} disabled={busy || !manualReady} className={primary}>Mark as Shipped</button>
              </div>
              {order.courierConnected && <button type="button" onClick={() => setManual(false)} className="text-xs text-muted hover:text-accent">← Use BharatShip instead</button>}
            </div>
          )}
        </div>
      )}

      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the timeline (optional)" maxLength={500} className="h-9 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" />

      <div className="flex flex-wrap gap-2">
        {allowed.includes("PACKED") && <button onClick={() => setStatus("PACKED")} disabled={busy} className={primary}><Package className="h-3.5 w-3.5" /> Mark as Packed</button>}
        {allowed.includes("DELIVERED") && <button onClick={() => setStatus("DELIVERED")} disabled={busy} className={primary}>Mark as Delivered</button>}
        {allowed.includes("CANCELLED") && <button onClick={() => setStatus("CANCELLED")} disabled={busy} className={cn(outline, "text-danger hover:bg-danger/10")}>Cancel order</button>}
        {busy && <Loader2 className="h-4 w-4 animate-spin self-center text-muted" />}
      </div>
      {actionErr && <p className="rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{actionErr}</p>}
    </div>
  );
}

const STEP_HINT: Partial<Record<OrderStatus, (o: AdminOrder) => string>> = {
  PENDING: (o) => `Waiting for online payment — auto-cancels after ${o.paymentWindowMinutes ?? 30} min if unpaid`,
  CONFIRMED: () => "Pack the order, then ship it",
  PACKED: () => "Ready to ship",
  SHIPPED: (o) => (o.paymentMethod === "COD" ? "Mark delivered once the courier delivers — records the COD payment" : "Mark delivered once the courier delivers"),
};
