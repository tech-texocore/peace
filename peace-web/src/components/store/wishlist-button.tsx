"use client";

import { Heart } from "lucide-react";
import { useWishlist } from "@/lib/wishlist";
import { cn } from "@/lib/utils/cn";
import { trackMeta } from "@/lib/meta-pixel";

export function WishlistButton({ productId, className, size = 18 }: { productId: string; className?: string; size?: number }) {
  const { has, toggle } = useWishlist();
  const on = has(productId);
  return (
    <button
      type="button"
      aria-label={on ? "Remove from wishlist" : "Save to wishlist"}
      aria-pressed={on}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!on) trackMeta("AddToWishlist", { content_ids: [productId], content_type: "product_group" }); toggle(productId); }}
      className={cn("inline-flex items-center justify-center rounded-full transition-colors", className)}
    >
      <Heart style={{ width: size, height: size }} className={cn("transition-colors", on ? "fill-rose-500 text-rose-500" : "text-current")} />
    </button>
  );
}
