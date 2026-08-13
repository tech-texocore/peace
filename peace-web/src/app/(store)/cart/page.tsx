"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Minus, Plus, Trash2, Tag, X, ShoppingBag, ArrowRight, Truck, Heart } from "lucide-react";
import { useCart, fetchQuote, type QuoteResult } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { TrustBadges } from "@/components/store/trust-badges";
import { getStoreShipping } from "@/lib/storefront-server";
import { env } from "@/lib/config/env";
import { cn } from "@/lib/utils/cn";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function CartPage() {
  const { items, ready, count, setQty, remove } = useCart();
  const wishlist = useWishlist();
  const [coupons, setCoupons] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("peace_coupons") ?? "[]"); } catch { return []; }
  });
  const [couponInput, setCouponInput] = useState("");
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [threshold, setThreshold] = useState(0);

  useEffect(() => { localStorage.setItem("peace_coupons", JSON.stringify(coupons)); }, [coupons]);
  useEffect(() => { getStoreShipping().then((s) => setThreshold(s.freeShippingThreshold)); }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    const q = await fetchQuote(env.apiBaseUrl, env.storeSlug, items, coupons);
    if (q && items.length) {
      const valid = new Set(q.lines.map((l) => l.variantId));
      items.filter((i) => !valid.has(i.variantId)).forEach((o) => remove(o.variantId));
    }
    setQuote(q);
    setLoading(false);
  }, [items, coupons, remove]);

  useEffect(() => { if (ready) refresh(); }, [ready, refresh]);

  function applyCoupon(e: React.FormEvent) {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (code && !coupons.includes(code)) setCoupons((c) => [...c, code]);
    setCouponInput("");
  }
  const removeCoupon = (code: string) => setCoupons((c) => c.filter((x) => x !== code));

  if (!ready || (loading && !quote)) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <ShoppingBag className="mx-auto h-12 w-12 text-muted/40" />
        <h1 className="mt-4 font-display text-2xl font-medium">Your cart is empty</h1>
        <p className="mt-2 text-sm text-muted">Browse the collection and add something you love.</p>
        <Link href="/products" className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90">Shop now <ArrowRight className="h-4 w-4" /></Link>
      </div>
    );
  }

  const lines = quote?.lines ?? [];
  const total = quote?.total ?? 0;
  const hasStockIssue = lines.some((l) => l.outOfStock || l.exceedsStock);
  const savings = lines.reduce((s, l) => s + (l.mrp && l.mrp > l.unitPrice ? (l.mrp - l.unitPrice) * l.quantity : 0), 0) + (quote?.totalDiscount ?? 0);
  const freeUnlocked = Boolean(quote?.freeShipping) || (threshold > 0 && total >= threshold);
  const remaining = Math.max(0, threshold - total);
  const pct = threshold > 0 ? Math.min(100, Math.round((total / threshold) * 100)) : 0;

  const saveForLater = (productId: string, variantId: string) => { if (!wishlist.has(productId)) wishlist.toggle(productId); remove(variantId); };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-5 lg:px-6">
      <div className="mb-6 flex items-end justify-between">
        <h1 className="font-display text-3xl font-medium">Your cart <span className="text-lg font-normal text-muted">· {count} item{count === 1 ? "" : "s"}</span></h1>
        <Link href="/products" className="hidden text-sm text-muted hover:text-accent sm:inline">← Continue shopping</Link>
      </div>

      {threshold > 0 && (
        <div className="mb-6 rounded-2xl border border-line bg-card p-4">
          {freeUnlocked ? (
            <p className="flex items-center gap-2 text-sm font-medium text-accent"><Truck className="h-4 w-4" /> You’ve unlocked FREE shipping on this order.</p>
          ) : (
            <>
              <p className="text-sm">Add <span className="font-semibold">{inr(remaining)}</span> more to get <span className="font-medium text-accent">FREE shipping</span>.</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} /></div>
            </>
          )}
        </div>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px]">
        <div className="divide-y divide-line rounded-2xl border border-line bg-card">
          {lines.map((l) => {
            const colour = l.attributes?.colour;
            const attrText = l.attributes ? Object.entries(l.attributes).map(([, v]) => v).join(" · ") : "";
            const saved = l.mrp && l.mrp > l.unitPrice ? (l.mrp - l.unitPrice) * l.quantity : 0;
            return (
              <div key={l.variantId} className="flex gap-4 p-4">
                <Link href={`/products/${l.slug}`} className="h-28 w-24 shrink-0 overflow-hidden rounded-xl border border-line bg-canvas">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {l.image && <img src={l.image} alt={l.title} className="h-full w-full object-cover" />}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/products/${l.slug}`} className="font-medium leading-snug hover:text-accent">{l.title}</Link>
                      {attrText && (
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                          {colour && <span className="inline-block h-3 w-3 rounded-full border border-black/15 align-middle" style={{ background: colour.toLowerCase() }} />}
                          {attrText}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-muted">{inr(l.unitPrice)}{l.uom !== "PIECE" ? ` / ${l.uom.toLowerCase()}` : " each"}</p>
                      {l.outOfStock ? (
                        <p className="mt-1 text-xs font-medium text-danger">Out of stock — remove to continue</p>
                      ) : l.exceedsStock ? (
                        <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">Only {l.stock} left — reduce quantity</p>
                      ) : null}
                    </div>
                    <button onClick={() => remove(l.variantId)} aria-label="Remove" className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger"><Trash2 className="h-4 w-4" /></button>
                  </div>

                  <div className="mt-auto flex items-end justify-between pt-3">
                    <div className={cn("flex items-center overflow-hidden rounded-full border", l.outOfStock ? "border-danger/40" : "border-line")}>
                      <button onClick={() => setQty(l.variantId, l.quantity - 1)} className="px-3 py-2 hover:bg-accent-soft" aria-label="Decrease"><Minus className="h-3.5 w-3.5" /></button>
                      <span className="min-w-9 text-center text-sm font-medium">{l.quantity}</span>
                      <button onClick={() => setQty(l.variantId, l.quantity + 1)} disabled={l.quantity >= l.stock} className="px-3 py-2 hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40" aria-label="Increase"><Plus className="h-3.5 w-3.5" /></button>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{inr(l.lineTotal)}</p>
                      {l.mrp && l.mrp > l.unitPrice && <p className="text-xs text-muted line-through">{inr(l.mrp * l.quantity)}</p>}
                      {saved > 0 && <p className="text-xs font-medium text-accent">Save {inr(saved)}</p>}
                    </div>
                  </div>

                  <button onClick={() => saveForLater(l.productId, l.variantId)} className="mt-3 inline-flex w-fit items-center gap-1.5 text-xs font-medium text-muted hover:text-accent">
                    <Heart className="h-3.5 w-3.5" /> Save for later
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <aside className="sticky top-20 h-fit space-y-4 rounded-2xl border border-line bg-card p-5">
          <h2 className="font-display text-lg">Order summary</h2>

          <form onSubmit={applyCoupon} className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Coupon code" className="h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm outline-none focus:border-accent" />
            </div>
            <button type="submit" className="rounded-lg border border-line px-4 text-sm font-medium hover:bg-accent-soft">Apply</button>
          </form>
          {coupons.map((code) => {
            const applied = quote?.appliedDiscounts.some((d) => d.code === code);
            const rejected = quote?.rejectedCoupons.find((r) => r.code === code);
            return (
              <div key={code} className="flex items-center justify-between gap-2 text-xs">
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 font-mono", applied ? "bg-accent-soft text-accent" : "bg-danger/10 text-danger")}>{code}{applied ? " ✓" : ""}</span>
                <span className="flex-1 truncate text-muted">{rejected ? rejected.reason : applied ? "Applied" : ""}</span>
                <button onClick={() => removeCoupon(code)} className="text-muted hover:text-danger"><X className="h-3.5 w-3.5" /></button>
              </div>
            );
          })}

          <div className="space-y-2 border-t border-line pt-4 text-sm">
            <div className="flex justify-between"><span className="text-muted">Subtotal ({count} item{count === 1 ? "" : "s"})</span><span>{inr(quote?.subtotal ?? 0)}</span></div>
            {quote?.appliedDiscounts.filter((d) => d.amount > 0).map((d) => (
              <div key={d.id} className="flex justify-between text-accent"><span className="truncate pr-2">{d.name}</span><span>−{inr(d.amount)}</span></div>
            ))}
            <div className="flex justify-between"><span className="text-muted">Shipping</span><span className={cn(freeUnlocked && "font-medium text-accent")}>{freeUnlocked ? "Free" : "Calculated at checkout"}</span></div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold"><span>Total</span><span>{inr(total)}</span></div>
            {savings > 0 && <p className="rounded-lg bg-accent-soft/60 px-2 py-1.5 text-center text-xs font-medium text-accent">You’re saving {inr(savings)} on this order 🎉</p>}
            <p className="text-xs text-muted">Inclusive of taxes. Shipping shown at checkout.</p>
          </div>

          {hasStockIssue ? (
            <div>
              <button disabled className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground opacity-50">
                Checkout <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-2 text-center text-xs font-medium text-danger">Remove or reduce the out-of-stock items above to continue.</p>
            </div>
          ) : (
            <Link href="/checkout" className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground hover:opacity-90">
              Checkout <ArrowRight className="h-4 w-4" />
            </Link>
          )}

          <TrustBadges limit={3} className="border-t border-line pt-4" />
          {loading && <p className="text-center text-xs text-muted">Updating…</p>}
        </aside>
      </div>
    </div>
  );
}
