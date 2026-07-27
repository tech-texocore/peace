"use client";

import { use, useEffect, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { getInvoice, inr, type Invoice } from "@/lib/orders";

export default function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [inv, setInv] = useState<Invoice | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => { getInvoice(id).then(setInv).catch(() => setMissing(true)); }, [id]);

  if (missing) return <div className="rounded-2xl border border-dashed border-line py-16 text-center text-sm text-muted">Invoice not available.</div>;
  if (!inv) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;

  const addr = inv.shippingAddress;
  const cgst = inv.taxAmount / 2;
  const taxable = inv.subtotal - inv.discount - inv.taxAmount;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <h1 className="font-display text-xl">Tax Invoice</h1>
        <button onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground"><Printer className="h-4 w-4" /> Print / Save PDF</button>
      </div>

      <div className="rounded-2xl border border-line bg-card p-6 text-sm print:border-0 print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-4">
          <div>
            <p className="font-display text-2xl">{inv.store.name}</p>
            {inv.store.gstin && <p className="text-muted">GSTIN: {inv.store.gstin}</p>}
            {inv.seller && <p className="text-muted">Sold by: {inv.seller.name}{inv.seller.city ? `, ${inv.seller.city}` : ""}</p>}
          </div>
          <div className="text-right">
            <p className="font-semibold">TAX INVOICE</p>
            <p className="text-muted">{inv.orderNumber}</p>
            <p className="text-muted">{new Date(inv.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
          </div>
        </div>

        <div className="grid gap-4 py-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Bill / Ship to</p>
            <p className="font-medium">{addr.recipientName}</p>
            <p className="text-muted">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ""}</p>
            <p className="text-muted">{addr.city}, {addr.state} — {addr.postalCode}</p>
            <p className="text-muted">{addr.recipientPhone}</p>
          </div>
          <div className="sm:text-right">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Payment</p>
            <p>{inv.paymentMethod === "COD" ? "Cash on Delivery" : "Prepaid"}</p>
            <p className="text-muted">{inv.paymentStatus}</p>
          </div>
        </div>

        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-line text-xs uppercase tracking-wide text-muted">
              <th className="py-2">Item</th>
              <th className="py-2 text-center">Qty</th>
              <th className="py-2 text-right">Rate</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => (
              <tr key={i} className="border-b border-line">
                <td className="py-2">{it.name}{it.sku ? <span className="block text-xs text-muted">{it.sku}</span> : null}</td>
                <td className="py-2 text-center">{it.quantity}</td>
                <td className="py-2 text-right">{inr(it.price ?? 0)}</td>
                <td className="py-2 text-right">{inr((it.price ?? 0) * it.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto mt-4 w-full max-w-xs space-y-1.5">
          <Row label="Taxable value" value={inr(Math.max(0, taxable))} />
          {inv.discount > 0 && <Row label="Discount" value={`− ${inr(inv.discount)}`} />}
          {inv.taxAmount > 0 && <><Row label="CGST" value={inr(cgst)} /><Row label="SGST" value={inr(cgst)} /></>}
          <Row label="Delivery" value={inv.shippingFee === 0 ? "FREE" : inr(inv.shippingFee)} />
          <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><span>Grand total</span><span>{inr(inv.total)}</span></div>
        </div>

        <p className="mt-6 border-t border-line pt-4 text-xs text-muted">This is a computer-generated invoice. Prices are inclusive of GST where applicable.</p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between text-sm"><span className="text-muted">{label}</span><span>{value}</span></div>;
}
