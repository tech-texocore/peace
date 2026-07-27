"use client";

import { useEffect, useState } from "react";
import { getStoreCardsByIds, type ProductCard as Card } from "@/lib/storefront-server";
import { ProductCard } from "@/components/store/product-card";

const KEY = "peace_recently_viewed";
const MAX = 12;
const SHOW = 10;

function read(): string[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}

export function RecentlyViewed({ currentId, title = "Recently viewed" }: { currentId?: string; title?: string }) {
  const [cards, setCards] = useState<Card[] | null>(null);

  useEffect(() => {
    const prev = read();
    const toShow = prev.filter((id) => id !== currentId).slice(0, SHOW);

    if (currentId) {
      const next = [currentId, ...prev.filter((x) => x !== currentId)].slice(0, MAX);
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
    }

    if (!toShow.length) { setCards([]); return; }
    getStoreCardsByIds(toShow)
      .then((res) => {
        const order = new Map(toShow.map((id, i) => [id, i]));
        setCards([...res].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99)));
      })
      .catch(() => setCards([]));
  }, [currentId]);

  if (!cards || cards.length === 0) return null;

  return (
    <section className="mt-14">
      <h2 className="mb-6 font-display text-2xl font-medium">{title}</h2>
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {cards.map((p) => <ProductCard key={p.id} p={p} />)}
      </div>
    </section>
  );
}
