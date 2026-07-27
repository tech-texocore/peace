"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Heart, Loader2 } from "lucide-react";
import { useWishlist } from "@/lib/wishlist";
import { getStoreCardsByIds, type ProductCard as Card } from "@/lib/storefront-server";
import { ProductCard } from "@/components/store/product-card";

export default function WishlistPage() {
  const { ids, count, ready } = useWishlist();
  const [cards, setCards] = useState<Card[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!ids.length) { setCards([]); return; }
    getStoreCardsByIds(ids).then(setCards).catch(() => setCards([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, count]);

  // Keep the grid in sync with removals without refetching.
  const shown = (cards ?? []).filter((c) => ids.includes(c.id));

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-5 lg:px-6">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 font-display text-3xl font-medium"><Heart className="h-7 w-7 text-rose-500" /> Wishlist</h1>
        <p className="mt-1 text-sm text-muted">{count > 0 ? `${count} saved item${count === 1 ? "" : "s"}` : "Save the pieces you love."}</p>
      </header>

      {!ready || cards === null ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>
      ) : shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-20 text-center">
          <Heart className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-3 text-sm text-muted">Your wishlist is empty.</p>
          <Link href="/products" className="mt-4 inline-block rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground">Explore products</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {shown.map((p) => <ProductCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}
