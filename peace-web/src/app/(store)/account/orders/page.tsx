"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Package, ChevronRight } from "lucide-react";
import { getMyOrders, inr, type Order } from "@/lib/orders";
import { OrderStatusBadge } from "@/components/store/order-status-badge";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);

  useEffect(() => { getMyOrders().then(setOrders).catch(() => setOrders([])); }, []);

  if (!orders) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;

  if (!orders.length) {
    return (
      <div className="rounded-2xl border border-dashed border-line py-16 text-center">
        <Package className="mx-auto h-8 w-8 text-muted" />
        <p className="mt-3 text-sm text-muted">You haven’t placed any orders yet.</p>
        <Link href="/products" className="mt-4 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground">Start shopping</Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {orders.map((o) => (
        <Link key={o.id} href={`/account/orders/${o.id}`} className="flex items-center gap-4 rounded-2xl border border-line p-4 hover:bg-accent-soft/30">
          <div className="flex -space-x-3">
            {o.items.slice(0, 3).map((it, i) => (
              <span key={i} className="h-12 w-10 overflow-hidden rounded-lg border border-line bg-accent-soft/30">{it.image && <img src={it.image} alt="" className="h-full w-full object-cover" />}</span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{o.orderNumber}</span>
              <OrderStatusBadge status={o.status} />
            </div>
            <p className="mt-0.5 truncate text-xs text-muted">
              {o.items.length} item{o.items.length === 1 ? "" : "s"} · {new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{inr(o.total)}</p>
            <p className="text-xs text-muted">{o.paymentMethod === "COD" ? "COD" : "Prepaid"}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
        </Link>
      ))}
    </div>
  );
}
