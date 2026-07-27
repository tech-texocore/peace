"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, ShoppingBag, Truck, RotateCcw, ShieldCheck, Store, Ruler, X, Minus, Plus, Tag, Share2, Copy, Expand, ChevronLeft, ChevronRight, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { api } from "@/lib/api/client";
import { useCart } from "@/lib/cart";
import { ProductCard } from "@/components/store/product-card";
import { RecentlyViewed } from "@/components/store/recently-viewed";
import { Stars } from "@/components/store/star-rating";
import { Lightbox } from "@/components/store/lightbox";
import { ReviewsSection } from "@/components/store/reviews-section";
import { WishlistButton } from "@/components/store/wishlist-button";
import type { ProductDetail, StoreOffer } from "@/lib/storefront-server";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function ProductDetailView({ product: p, offers = [] }: { product: ProductDetail; offers?: StoreOffer[] }) {
  const cart = useCart();
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav?.share) { try { await nav.share({ title: p.title, url }); return; } catch { /* dismissed */ } }
    if (nav?.clipboard) { await nav.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
  }
  const axes = p.variantAxes ?? [];
  const valuesByAxis = useMemo(() => {
    const m: Record<string, string[]> = {};
    axes.forEach((a) => { m[a] = Array.from(new Set(p.variants.map((v) => v.attributes?.[a]).filter(Boolean) as string[])); });
    return m;
  }, [axes, p.variants]);
  const activeAxes = useMemo(() => axes.filter((a) => (valuesByAxis[a]?.length ?? 0) > 0), [axes, valuesByAxis]);

  const firstInStock = p.variants.find((v) => v.stock > 0) ?? p.variants[0];
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    activeAxes.forEach((a) => { init[a] = firstInStock?.attributes?.[a] ?? ""; });
    return init;
  });
  const [mainMedia, setMainMedia] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifySent, setNotifySent] = useState(false);

  async function notifyMe() {
    if (!variant || !/.+@.+\..+/.test(notifyEmail)) return;
    try { await api.post("/inventory/notify-me", { variantId: variant.id, email: notifyEmail }); setNotifySent(true); } catch { setNotifySent(true); }
  }
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [qty, setQty] = useState(1);
  const unit = p.uom && p.uom !== "PIECE" ? p.uom.toLowerCase() : null;

  const variant = activeAxes.length
    ? p.variants.find((v) => activeAxes.every((a) => v.attributes?.[a] === selected[a]))
    : p.variants[0];
  const price = variant ? Number(variant.price) : p.priceFrom ?? 0;
  const mrp = variant?.mrp ? Number(variant.mrp) : null;
  const discount = mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const stock = variant?.stock ?? 0;
  const inCart = variant ? cart.items.find((l) => l.variantId === variant.id) : undefined;
  const sizeRows = p.sizeGuide ? p.sizeGuide.items.filter((it) => (valuesByAxis.size ?? []).includes(it.value)) : [];

  const colourAxis = activeAxes.find((a) => a.toLowerCase().includes("colour") || a.toLowerCase().includes("color"));
  const selectedColour = colourAxis ? selected[colourAxis] : undefined;
  const colourByVariant = useMemo(() => new Map(p.variants.map((v) => [v.id, v.attributes?.colour])), [p.variants]);
  const media = useMemo(() => {
    const all = p.media ?? [];
    if (!selectedColour) return all;
    const taggedTo = (m: (typeof all)[number]) =>
      (m.colours ?? []).includes(selectedColour) || (m.variantId ? colourByVariant.get(m.variantId) === selectedColour : false);
    const isShared = (m: (typeof all)[number]) => !(m.colours ?? []).length && !m.variantId;
    const forColour = all.filter(taggedTo);
    const shared = all.filter(isShared);
    if (forColour.length) return [...forColour, ...shared];
    return shared.length ? shared : all;
  }, [p.media, colourByVariant, selectedColour]);
  useEffect(() => { setMainMedia(0); }, [selectedColour]);
  const touchX = useRef<number | null>(null);
  const gallery = (d: number) => { if (media.length) setMainMedia((i) => (i + d + media.length) % media.length); };

  const stepperMode = !unit && !p.isCustomizable;
  const isCustom = p.isCustomizable && (p.customizationFields?.length ?? 0) > 0;
  const customMissing = isCustom
    ? (p.customizationFields ?? []).filter((f) => f.required && !(custom[f.label] ?? "").trim()).map((f) => f.label)
    : [];
  const doAdd = () => { if (variant) { cart.add(variant.id, stepperMode ? 1 : qty, Object.keys(custom).length ? custom : undefined); setShowCustomize(false); } };

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-5 lg:px-6">
      <nav className="mb-4 text-xs text-muted">
        <a href="/products" className="hover:text-accent">Shop</a>
        {p.category && <> · <a href={`/products?category=${p.category.slug}`} className="hover:text-accent">{p.category.name}</a></>}
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,480px)_minmax(0,1fr)] lg:items-start">
        <div>
          <div
            className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-accent-soft/30"
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => { if (touchX.current == null) return; const dx = e.changedTouches[0].clientX - touchX.current; if (Math.abs(dx) > 40) gallery(dx < 0 ? 1 : -1); touchX.current = null; }}
          >
            {media[mainMedia]?.type === "VIDEO" ? (
              <video src={media[mainMedia].url} controls className="h-full w-full object-cover" />
            ) : media[mainMedia] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media[mainMedia].url} alt={p.title} onClick={() => setLightboxOpen(true)} className="h-full w-full cursor-zoom-in object-cover" />
            ) : <div className="flex h-full items-center justify-center text-muted">No image</div>}

            {media[mainMedia] && media[mainMedia].type !== "VIDEO" && (
              <button onClick={() => setLightboxOpen(true)} className="absolute right-3 top-3 rounded-full bg-black/45 p-2 text-white opacity-0 transition-opacity group-hover:opacity-100" aria-label="View full screen"><Expand className="h-4 w-4" /></button>
            )}

            {media.length > 1 && (
              <>
                <button onClick={() => gallery(-1)} aria-label="Previous image" className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100"><ChevronLeft className="h-5 w-5" /></button>
                <button onClick={() => gallery(1)} aria-label="Next image" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100"><ChevronRight className="h-5 w-5" /></button>
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {media.map((_, i) => <span key={i} className={cn("h-1.5 rounded-full bg-white transition-all", i === mainMedia ? "w-5" : "w-1.5 opacity-50")} />)}
                </div>
              </>
            )}
          </div>
          {media.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {media.map((m, i) => (
                <button key={m.id} onClick={() => setMainMedia(i)} className={cn("relative h-20 w-16 shrink-0 overflow-hidden rounded-lg border", i === mainMedia ? "border-accent" : "border-line")}>
                  {m.type === "VIDEO" ? (
                    <video src={m.url} className="h-full w-full object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              {p.brand && <span className="text-xs uppercase tracking-widest text-muted">{p.brand.name}</span>}
              <h1 className="mt-1 font-display text-3xl font-medium">{p.title}</h1>
            </div>
            <div className="mt-1 flex shrink-0 items-center gap-2">
              <WishlistButton productId={p.id} className="h-9 w-9 border border-line hover:bg-accent-soft" size={18} />
              <button onClick={share} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-2 text-xs font-medium hover:bg-accent-soft" title="Share">
                {copied ? <><Copy className="h-3.5 w-3.5" /> Copied</> : <><Share2 className="h-3.5 w-3.5" /> Share</>}
              </button>
            </div>
          </div>

          {p.ratingCount > 0 && (
            <a href="#reviews" className="mt-2 inline-flex items-center gap-2 text-sm hover:underline">
              <Stars value={p.ratingAvg} size={16} />
              <span className="font-medium">{p.ratingAvg.toFixed(1)}</span>
              <span className="text-muted">· {p.ratingCount} review{p.ratingCount === 1 ? "" : "s"}</span>
            </a>
          )}

          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-2xl font-semibold">{inr(price)}{unit && <span className="text-base font-normal text-muted"> / {unit}</span>}</span>
            {mrp && mrp > price && <span className="text-lg text-muted line-through">{inr(mrp)}</span>}
            {discount > 0 && <span className="rounded-full bg-accent-soft px-2.5 py-1 text-sm font-semibold text-accent">{discount}% OFF</span>}
          </div>
          <p className="mt-1 text-xs text-muted">{p.taxInclusive ? "Inclusive of all taxes" : "Taxes extra at checkout"}</p>

          {offers.length > 0 && (
            <div className="mt-5 rounded-xl border border-line p-4">
              <p className="mb-2 flex items-center gap-1.5 text-sm font-medium"><Tag className="h-4 w-4 text-accent" /> Available offers</p>
              <ul className="space-y-2">
                {offers.slice(0, 4).map((o) => (
                  <li key={o.code} className="flex items-start gap-2 text-sm">
                    <span className="mt-0.5 rounded border border-dashed border-accent px-1.5 py-0.5 text-xs font-semibold text-accent">{o.code}</span>
                    <span className="text-muted"><span className="text-ink">{o.label}</span> · {o.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeAxes.map((axis) => (
            <div key={axis} className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium capitalize">{axis}</p>
                {axis === "size" && sizeRows.length > 0 && (
                  <button type="button" onClick={() => setShowSizeChart(true)} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline">
                    <Ruler className="h-3.5 w-3.5" /> Size chart
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {valuesByAxis[axis].map((val) => {
                  const on = selected[axis] === val;
                  const isColour = axis.toLowerCase().includes("colour") || axis.toLowerCase().includes("color");
                  return (
                    <button key={val} onClick={() => setSelected((s) => ({ ...s, [axis]: val }))}
                      className={cn("flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors", on ? "border-accent bg-accent text-accent-foreground" : "border-line hover:bg-accent-soft")}>
                      {isColour && <span className="h-4 w-4 rounded-full border border-black/15" style={{ background: val.toLowerCase() }} />}
                      {val}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <p className={cn("mt-4 text-sm", stock > 0 ? "text-accent" : "text-danger")}>
            {stock > 0 ? (stock <= 5 ? `Only ${stock} left in stock` : "In stock") : "Out of stock"}
          </p>

          {!stepperMode && (
            <div className="mt-5">
              <p className="mb-2 text-sm font-medium">{unit ? `Length (${unit})` : "Quantity"}</p>
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center rounded-full border border-line">
                  <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="p-2.5 hover:text-accent"><Minus className="h-4 w-4" /></button>
                  <span className="min-w-8 text-center text-sm font-medium">{qty}</span>
                  <button type="button" onClick={() => setQty((q) => q + 1)} className="p-2.5 hover:text-accent"><Plus className="h-4 w-4" /></button>
                </div>
                {unit && <span className="text-sm text-muted">Total: <span className="font-medium text-ink">{inr(price * qty)}</span> for {qty} {unit}{qty > 1 ? "s" : ""}</span>}
              </div>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {stepperMode && inCart && variant ? (
              <>
                <div className="inline-flex items-center rounded-full border-2 border-accent">
                  <button type="button" onClick={() => cart.setQty(variant.id, inCart.quantity - 1)} className="p-3 text-accent hover:opacity-70" aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
                  <span className="min-w-10 text-center text-sm font-semibold">{inCart.quantity}</span>
                  <button type="button" disabled={inCart.quantity >= stock} onClick={() => cart.setQty(variant.id, inCart.quantity + 1)} className="p-3 text-accent hover:opacity-70 disabled:opacity-40" aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
                </div>
                <Link href="/cart" className="inline-flex items-center gap-1 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground hover:opacity-90">Go to cart →</Link>
              </>
            ) : isCustom ? (
              <>
                <button
                  disabled={stock <= 0 || !variant}
                  onClick={() => setShowCustomize(true)}
                  className="flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50 sm:px-10"
                >
                  {stock <= 0 ? "Sold out" : <><Wand2 className="h-5 w-5" /> {inCart ? "Customise another" : "Customise & add"}</>}
                </button>
                {inCart && <Link href="/cart" className="text-sm font-medium text-accent underline underline-offset-4">In cart ({inCart.quantity}) · View cart →</Link>}
              </>
            ) : (
              <>
                <button
                  disabled={stock <= 0 || !variant}
                  onClick={doAdd}
                  className="flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50 sm:px-10"
                >
                  {stock <= 0 ? "Sold out" : inCart ? <><Check className="h-5 w-5" /> Add more</> : <><ShoppingBag className="h-5 w-5" /> Add to cart</>}
                </button>
                {inCart && <Link href="/cart" className="text-sm font-medium text-accent underline underline-offset-4">In cart ({inCart.quantity}{unit ? ` ${unit}` : ""}) · View cart →</Link>}
              </>
            )}
          </div>

          {stock <= 0 && variant && (
            <div className="mt-4 rounded-xl border border-line p-4">
              {notifySent ? (
                <p className="text-sm text-accent">✓ We’ll email you when this is back in stock.</p>
              ) : (
                <>
                  <p className="mb-2 text-sm font-medium">Out of stock — get notified when it’s back</p>
                  <div className="flex gap-2">
                    <input value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} type="email" placeholder="Your email" className="h-10 flex-1 rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" />
                    <button onClick={notifyMe} disabled={!/.+@.+\..+/.test(notifyEmail)} className="h-10 rounded-full bg-ink px-4 text-sm font-medium text-canvas hover:opacity-90 disabled:opacity-50">Notify me</button>
                  </div>
                </>
              )}
            </div>
          )}

          {p.description && <p className="mt-6 whitespace-pre-line text-sm leading-relaxed text-muted">{p.description}</p>}

          <div className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <span className="flex items-center gap-2 text-muted"><Truck className="h-4 w-4 text-accent" /> Ships in {p.seller.dispatchDays}d</span>
            {p.seller.returnable && <span className="flex items-center gap-2 text-muted"><RotateCcw className="h-4 w-4 text-accent" /> {p.seller.returnWindowDays}-day return</span>}
            {p.seller.codAvailable && <span className="flex items-center gap-2 text-muted"><ShieldCheck className="h-4 w-4 text-accent" /> COD available</span>}
            <span className="flex items-center gap-2 text-muted"><Store className="h-4 w-4 text-accent" /> {p.seller.name}</span>
          </div>

          {(p.specifications?.length ?? 0) > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 font-display text-lg">Product details</h2>
              <table className="w-full text-sm">
                <tbody>
                  {p.specifications!.map((s) => (
                    <tr key={s.key} className="border-b border-line last:border-0">
                      <td className="py-2 pr-4 text-muted">{s.label}</td>
                      <td className="py-2 font-medium">{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ReviewsSection productId={p.id} initialAvg={p.ratingAvg} initialCount={p.ratingCount} />

      {p.related.length > 0 && (
        <section className="mt-14">
          <h2 className="mb-6 font-display text-2xl font-medium">You may also like</h2>
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4">
            {p.related.map((rp) => <ProductCard key={rp.id} p={rp} />)}
          </div>
        </section>
      )}

      <RecentlyViewed currentId={p.id} />

      {lightboxOpen && media.length > 0 && (
        <Lightbox media={media.map((m) => ({ url: m.url, type: m.type }))} start={mainMedia} onClose={() => setLightboxOpen(false)} />
      )}

      {showCustomize && isCustom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/50" onClick={() => setShowCustomize(false)} aria-label="Close" />
          <div className="relative flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl border border-line bg-card shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h3 className="flex items-center gap-2 font-display text-lg"><Wand2 className="h-5 w-5 text-accent" /> Personalise your order</h3>
                <p className="mt-0.5 text-xs text-muted">Fields marked <span className="text-danger">*</span> are required · the rest are optional.</p>
              </div>
              <button onClick={() => setShowCustomize(false)} className="rounded-lg p-1.5 text-muted hover:bg-accent-soft"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {(p.customizationFields ?? []).map((cf, i) => (
                <label key={i} className="block">
                  <span className="mb-1.5 block text-sm font-medium">{cf.label}{cf.required ? <span className="text-danger"> *</span> : <span className="font-normal text-muted"> (optional)</span>}</span>
                  {cf.type === "textarea" ? (
                    <textarea rows={3} value={custom[cf.label] ?? ""} onChange={(e) => setCustom((c) => ({ ...c, [cf.label]: e.target.value }))} className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent" />
                  ) : cf.type === "select" ? (
                    <div className="relative">
                      <select value={custom[cf.label] ?? ""} onChange={(e) => setCustom((c) => ({ ...c, [cf.label]: e.target.value }))} className="h-11 w-full appearance-none rounded-lg border border-line bg-canvas pl-3 pr-9 text-sm outline-none focus:border-accent">
                        <option value="">Select…</option>
                        {(cf.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                      <ChevronRight className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 rotate-90 text-muted" />
                    </div>
                  ) : cf.type === "image" ? (
                    <input type="file" accept="image/*" className="text-xs text-muted" />
                  ) : (
                    <input type={cf.type === "number" ? "number" : "text"} value={custom[cf.label] ?? ""} onChange={(e) => setCustom((c) => ({ ...c, [cf.label]: e.target.value }))} className="h-11 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" />
                  )}
                </label>
              ))}
            </div>

            <div className="border-t border-line px-5 py-4">
              {customMissing.length > 0 && <p className="mb-2 text-xs text-danger">Please fill: {customMissing.join(", ")}</p>}
              <div className="flex items-center gap-3">
                <button onClick={doAdd} disabled={customMissing.length > 0 || stock <= 0} className="flex flex-1 items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50">
                  <ShoppingBag className="h-4 w-4" /> Add to cart · {inr(price * qty)}
                </button>
                <button onClick={() => setShowCustomize(false)} className="text-sm text-muted hover:text-ink">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSizeChart && p.sizeGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/50" onClick={() => setShowSizeChart(false)} aria-label="Close" />
          <div className="relative w-full max-w-lg rounded-2xl border border-line bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-lg"><Ruler className="h-5 w-5 text-accent" /> Size chart</h3>
              <button onClick={() => setShowSizeChart(false)} className="rounded-lg p-1.5 text-muted hover:bg-accent-soft"><X className="h-5 w-5" /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-4 font-semibold">Size</th>
                    {p.sizeGuide.fields.map((f) => <th key={f.key} className="py-2 pr-4 font-semibold">{f.label}{f.unit ? ` (${f.unit})` : ""}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {sizeRows.map((row) => (
                    <tr key={row.value} className="border-b border-line last:border-0">
                      <td className="py-2 pr-4 font-medium">{row.label}</td>
                      {p.sizeGuide!.fields.map((f) => <td key={f.key} className="py-2 pr-4 text-muted">{row.metadata?.[f.key] != null ? String(row.metadata[f.key]) : "—"}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted">Measurements are in inches. If you’re between sizes, we suggest sizing up.</p>
          </div>
        </div>
      )}
    </div>
  );
}
