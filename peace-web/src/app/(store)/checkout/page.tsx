"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, Truck, CreditCard, Banknote, ShieldCheck, Plus, Check, ChevronLeft } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { AuthForm } from "@/components/account/auth-form";
import { api } from "@/lib/api/client";
import { env } from "@/lib/config/env";
import { useCart, fetchQuote, type QuoteResult } from "@/lib/cart";
import { cn } from "@/lib/utils/cn";
import {
  getCheckoutConfig, createOrder, verifyPayment, inr,
  type CheckoutConfig, type PaymentMethod,
} from "@/lib/orders";

interface Address {
  id: string; recipientName: string; recipientPhone: string; line1: string; line2?: string | null;
  city: string; state: string; postalCode: string; isDefault: boolean; type: string;
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true); s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function CheckoutPage() {
  const { user, loading } = useAuth();
  const { items, clear } = useCart();
  const router = useRouter();

  const [config, setConfig] = useState<CheckoutConfig | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [addressId, setAddressId] = useState<string>("");
  const [deliveryMethod, setDeliveryMethod] = useState<string>("standard");
  const [payment, setPayment] = useState<PaymentMethod>("COD");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [booting, setBooting] = useState(true);

  const couponCodes = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("peace_coupons") ?? "[]") as string[]; } catch { return []; }
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const cfg = await getCheckoutConfig();
        setConfig(cfg);
        setDeliveryMethod(cfg.delivery.methods[0]?.key ?? "standard");
        if (!cfg.payment.razorpay.enabled) setPayment("COD");
        const addr = await api.get<Address[]>("/account/addresses", { auth: true }).catch(() => [] as Address[]);
        setAddresses(addr);
        setAddressId(addr.find((a) => a.isDefault)?.id ?? addr[0]?.id ?? "");
      } catch (e) {
        setError((e as Error)?.message ?? "Couldn't load checkout. Please refresh and try again.");
      } finally { setBooting(false); }
    })();
  }, [user]);

  useEffect(() => {
    if (!user || !items.length) return;
    fetchQuote(env.apiBaseUrl, env.storeSlug, items, couponCodes).then(setQuote);
  }, [user, items, couponCodes]);

  if (loading || (user && booting)) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;
  }
  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <h1 className="mb-2 text-center font-display text-2xl">Sign in to check out</h1>
        <p className="mb-6 text-center text-sm text-muted">Your cart is saved — sign in to place your order.</p>
        <AuthForm />
      </div>
    );
  }
  if (!items.length) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="font-display text-2xl">Your cart is empty</h1>
        <Link href="/products" className="mt-6 inline-block rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground">Shop now</Link>
      </div>
    );
  }

  const method = config?.delivery.methods.find((m) => m.key === deliveryMethod) ?? config?.delivery.methods[0];
  const freeShip = Boolean(quote?.freeShipping) || (quote != null && config != null && quote.total >= config.delivery.freeShippingThreshold);
  const shipFee = freeShip ? 0 : method?.fee ?? 0;
  const codFee = payment === "COD" ? config?.cod.fee ?? 0 : 0;
  const grandTotal = (quote?.total ?? 0) + shipFee + codFee;

  async function placeOrder() {
    if (!addressId) { setError("Please select a delivery address"); return; }
    setPlacing(true); setError("");
    try {
      const res = await createOrder({
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, customization: i.customization })),
        couponCodes, addressId, deliveryMethod, paymentMethod: payment,
      });

      if (res.paymentMethod === "COD" || !res.payment) {
        clear(); localStorage.removeItem("peace_coupons");
        router.push(`/account/orders/${res.id}?placed=1`);
        return;
      }

      // Online payment via Razorpay
      const ok = await loadRazorpay();
      if (!ok) { setError("Could not load payment. Please try COD."); setPlacing(false); return; }
      const rzp = new (window as unknown as { Razorpay: new (o: unknown) => { open: () => void } }).Razorpay({
        key: res.payment.keyId, order_id: res.payment.orderId, amount: res.payment.amount, currency: res.payment.currency,
        name: "Peace", description: `Order ${res.orderNumber}`,
        handler: async (r: { razorpay_payment_id: string; razorpay_signature: string }) => {
          try { await verifyPayment(res.id, r.razorpay_payment_id, r.razorpay_signature); clear(); localStorage.removeItem("peace_coupons"); router.push(`/account/orders/${res.id}?placed=1`); }
          catch { router.push(`/account/orders/${res.id}`); }
        },
        modal: { ondismiss: () => setPlacing(false) },
        theme: { color: "#111111" },
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not place order");
      setPlacing(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 sm:px-5 lg:px-6">
      <div className="mb-6">
        <Link href="/cart" className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent"><ChevronLeft className="h-4 w-4" /> Back to cart</Link>
        <h1 className="mt-2 font-display text-2xl font-medium">Checkout</h1>
        <p className="text-sm text-muted">Confirm your address, delivery and payment — it only takes a minute.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {/* Address */}
          <section className="rounded-2xl border border-line p-5">
            <StepHead n={1} icon={MapPin} title="Delivery address" note="Where should we deliver your order?" />
            {addresses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line p-5 text-center text-sm text-muted">
                No saved address. <Link href="/account/addresses" className="font-medium text-accent hover:underline">Add one</Link> to continue.
              </div>
            ) : (
              <div className="space-y-2">
                {addresses.map((a) => (
                  <button key={a.id} onClick={() => setAddressId(a.id)} className={cn("flex w-full items-start gap-3 rounded-xl border p-3 text-left", addressId === a.id ? "border-accent bg-accent-soft/40" : "border-line hover:bg-accent-soft/30")}>
                    <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", addressId === a.id ? "border-accent bg-accent" : "border-line")}>{addressId === a.id && <Check className="h-3 w-3 text-accent-foreground" />}</span>
                    <span className="text-sm">
                      <span className="font-medium">{a.recipientName}</span> · {a.recipientPhone}
                      {a.isDefault && <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">Default</span>}
                      <span className="mt-0.5 block text-muted">{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} — {a.postalCode}</span>
                    </span>
                  </button>
                ))}
                <Link href="/account/addresses" className="inline-flex items-center gap-1 pt-1 text-sm font-medium text-accent hover:underline"><Plus className="h-4 w-4" /> Add new address</Link>
              </div>
            )}
          </section>

          {/* Delivery method */}
          <section className="rounded-2xl border border-line p-5">
            <StepHead n={2} icon={Truck} title="Delivery option" note="Choose how soon you’d like to receive it." />
            <div className="grid gap-2 sm:grid-cols-2">
              {config?.delivery.methods.map((m) => {
                const willBeFree = freeShip;
                return (
                  <button key={m.key} onClick={() => setDeliveryMethod(m.key)} className={cn("rounded-xl border p-3 text-left text-sm", deliveryMethod === m.key ? "border-accent bg-accent-soft/40" : "border-line hover:bg-accent-soft/30")}>
                    <span className="font-medium">{m.label}</span>
                    <span className="mt-0.5 block text-muted">{m.days} day{m.days === 1 ? "" : "s"} · {willBeFree ? "FREE" : inr(m.fee)}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Payment */}
          <section className="rounded-2xl border border-line p-5">
            <StepHead n={3} icon={CreditCard} title="Payment method" note="Pay securely online, or choose Cash on Delivery." />
            <div className="space-y-2">
              {config?.cod.enabled && (
                <button onClick={() => setPayment("COD")} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm", payment === "COD" ? "border-accent bg-accent-soft/40" : "border-line hover:bg-accent-soft/30")}>
                  <Banknote className="h-5 w-5 text-accent" /> <span><span className="font-medium">Cash on Delivery</span>{config.cod.fee > 0 && <span className="text-muted"> · +{inr(config.cod.fee)}</span>}</span>
                </button>
              )}
              {config?.payment.razorpay.enabled ? (
                <button onClick={() => setPayment("RAZORPAY")} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm", payment === "RAZORPAY" ? "border-accent bg-accent-soft/40" : "border-line hover:bg-accent-soft/30")}>
                  <CreditCard className="h-5 w-5 text-accent" /> <span className="font-medium">UPI / Card / Netbanking</span>
                </button>
              ) : (
                <p className="rounded-xl border border-dashed border-line p-3 text-xs text-muted">Online payment will be available soon. You can pay by Cash on Delivery.</p>
              )}
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside className="h-fit rounded-2xl border border-line p-5 lg:sticky lg:top-20">
          <h2 className="mb-3 font-medium">Order summary</h2>
          <div className="max-h-52 space-y-3 overflow-y-auto">
            {quote?.lines.map((l) => (
              <Link key={l.variantId} href={`/products/${l.slug}`} className="flex gap-3 rounded-lg text-sm hover:bg-accent-soft/40">
                <span className="h-12 w-10 shrink-0 overflow-hidden rounded-lg border border-line bg-accent-soft/30">{l.image && <img src={l.image} alt="" className="h-full w-full object-cover" />}</span>
                <span className="flex-1 hover:text-accent">{l.title}<span className="block text-xs text-muted">Qty {l.quantity}{l.uom !== "PIECE" ? ` ${l.uom.toLowerCase()}` : ""}</span></span>
                <span className="font-medium">{inr(l.lineTotal)}</span>
              </Link>
            ))}
          </div>
          <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
            <Row label="Subtotal" value={inr(quote?.subtotal ?? 0)} />
            {quote && quote.totalDiscount > 0 && <Row label="Discount" value={`− ${inr(quote.totalDiscount)}`} accent />}
            <Row label="Delivery" value={shipFee === 0 ? "FREE" : inr(shipFee)} />
            {codFee > 0 && <Row label="COD fee" value={inr(codFee)} />}
            <div className="flex justify-between border-t border-line pt-2 text-base font-semibold"><span>Total</span><span>{inr(grandTotal)}</span></div>
            <p className="pt-1 text-xs text-muted">Inclusive of all taxes</p>
          </div>

          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          <button onClick={placeOrder} disabled={placing || !addressId} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent py-3.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50">
            {placing ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Place order · {inr(grandTotal)}</>}
          </button>
          <p className="mt-2 flex items-center justify-center gap-1 text-xs text-muted"><ShieldCheck className="h-3.5 w-3.5" /> Secure checkout</p>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return <div className="flex justify-between"><span className="text-muted">{label}</span><span className={accent ? "font-medium text-accent" : ""}>{value}</span></div>;
}

function StepHead({ n, icon: Icon, title, note }: { n: number; icon: React.ComponentType<{ className?: string }>; title: string; note: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{n}</span>
      <div>
        <h2 className="flex items-center gap-1.5 font-medium"><Icon className="h-4 w-4 text-accent" /> {title}</h2>
        <p className="text-xs text-muted">{note}</p>
      </div>
    </div>
  );
}
