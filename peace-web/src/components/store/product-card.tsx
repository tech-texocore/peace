"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Minus, Bell } from "lucide-react";
import { useCart } from "@/lib/cart";
import { Stars } from "@/components/store/star-rating";
import { WishlistButton } from "@/components/store/wishlist-button";
import { cn } from "@/lib/utils/cn";
import type { ProductCard as Card } from "@/lib/storefront-server";

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export function ProductCard({ p }: { p: Card }) {
  const { items, add, setQty } = useCart();
  const [colour, setColour] = useState<string | null>(p.colourVariants[0]?.colour ?? null);

  const activeCV = colour ? p.colourVariants.find((cv) => cv.colour === colour) : undefined;
  const activeVid = activeCV?.variantId ?? p.defaultVariantId;
  const activeInStock = activeCV ? activeCV.inStock : p.inStock;
  const displayImage = activeCV?.image ?? p.image;
  const inCart = activeVid ? items.find((l) => l.variantId === activeVid) : undefined;

  return (
    <div className="group flex flex-col">
      <Link href={`/products/${p.slug}`} className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-accent-soft/30">
        {displayImage ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={displayImage} alt={p.title} className={cn("h-full w-full object-cover transition-opacity duration-300", p.hoverImage && displayImage === p.image && "group-hover:opacity-0")} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {p.hoverImage && displayImage === p.image && <img src={p.hoverImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100" />}
          </>
        ) : <div className="flex h-full items-center justify-center text-sm text-muted">No image</div>}
        {p.discountPct > 0 && <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">{p.discountPct}% OFF</span>}
        {!p.inStock && <span className="absolute left-3 bottom-3 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-medium text-canvas">Sold out</span>}
        <WishlistButton productId={p.id} className="absolute right-2 top-2 h-8 w-8 bg-canvas/80 text-ink backdrop-blur hover:bg-canvas" size={16} />
      </Link>

      <div className="mt-3 flex flex-1 flex-col gap-1.5">
        {p.brand && <span className="text-xs uppercase tracking-wide text-muted">{p.brand}</span>}
        <Link href={`/products/${p.slug}`}><h3 className="text-sm font-medium leading-snug hover:text-accent">{p.title}</h3></Link>
        {p.ratingCount > 0 && (
          <span className="flex items-center gap-1"><Stars value={p.ratingAvg} size={12} /><span className="text-[11px] text-muted">({p.ratingCount})</span></span>
        )}
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{inr(p.priceFrom)}</span>
          {p.mrp && p.mrp > p.priceFrom && <span className="text-xs text-muted line-through">{inr(p.mrp)}</span>}
          {p.discountPct > 0 && <span className="text-xs font-medium text-accent">{p.discountPct}% off</span>}
        </div>

        {p.colourVariants.length > 0 && (
          <div className="flex min-h-6 items-center gap-1.5">
            {p.colourVariants.slice(0, 6).map((cv) => (
              <button
                key={cv.colour}
                type="button"
                title={cv.colour}
                aria-label={cv.colour}
                aria-pressed={cv.colour === colour}
                onClick={() => setColour(cv.colour)}
                className={cn(
                  "h-5 w-5 shrink-0 rounded-full border transition",
                  cv.colour === colour ? "border-ink ring-2 ring-ink ring-offset-1" : "border-black/15 hover:border-ink/50",
                  !cv.inStock && "opacity-40",
                )}
                style={{ background: cv.colour.toLowerCase() }}
              />
            ))}
            {p.colourVariants.length > 6 && <span className="text-xs text-muted">+{p.colourVariants.length - 6}</span>}
            {colour && <span className="ml-1 truncate text-xs text-muted">{colour}</span>}
          </div>
        )}

        <div className="mt-2">
          {!activeInStock ? (
            <Link href={`/products/${p.slug}`} className="flex w-full items-center justify-center gap-1.5 rounded-full border border-ink py-2.5 text-xs font-semibold text-ink transition-colors hover:bg-ink hover:text-canvas">
              <Bell className="h-3.5 w-3.5" /> Notify me
            </Link>
          ) : inCart ? (
            <div className="flex w-full items-center justify-between overflow-hidden rounded-full border-2 border-ink">
              <button onClick={() => activeVid && setQty(activeVid, inCart.quantity - 1)} className="flex h-9 w-12 items-center justify-center text-ink transition-colors hover:bg-ink hover:text-canvas" aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
              <span className="text-sm font-semibold text-ink">{inCart.quantity}</span>
              <button onClick={() => activeVid && setQty(activeVid, inCart.quantity + 1)} className="flex h-9 w-12 items-center justify-center text-ink transition-colors hover:bg-ink hover:text-canvas" aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
            </div>
          ) : (
            <button onClick={() => activeVid && add(activeVid, 1)} className="flex w-full items-center justify-center gap-1.5 rounded-full bg-ink py-2.5 text-xs font-semibold text-canvas hover:opacity-90">
              <Plus className="h-3.5 w-3.5" /> Add to cart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
