"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api/client";

export interface CartLine { variantId: string; quantity: number; customization?: Record<string, unknown> }

interface CartContextValue {
  items: CartLine[];
  count: number;
  ready: boolean;
  add: (variantId: string, quantity?: number, customization?: Record<string, unknown>) => void;
  setQty: (variantId: string, quantity: number) => void;
  remove: (variantId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const KEY = "peace_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const merged = useRef(false);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setItems(JSON.parse(raw)); } catch {}
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(items)); }, [items, ready]);

  // Sign-in: merge the guest cart into the account (cross-device persistence).
  useEffect(() => {
    if (!user) { merged.current = false; return; }
    if (!ready || merged.current) return;
    merged.current = true;
    (async () => {
      try {
        const local = JSON.parse(localStorage.getItem(KEY) ?? "[]") as CartLine[];
        const res = await api.post<{ items: CartLine[] }>("/cart/merge", { items: local }, { auth: true });
        setItems(res.items);
      } catch { /* offline / not synced */ }
    })();
  }, [user, ready]);

  // Keep the signed-in server cart in sync with local changes.
  useEffect(() => {
    if (!user || !ready || !merged.current) return;
    api.put("/cart", { items }, { auth: true }).catch(() => {});
  }, [items, user, ready]);

  const add = useCallback((variantId: string, quantity = 1, customization?: Record<string, unknown>) => {
    setItems((prev) => {
      const i = prev.findIndex((l) => l.variantId === variantId);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], quantity: next[i].quantity + quantity, ...(customization ? { customization } : {}) };
        return next;
      }
      return [...prev, { variantId, quantity, customization }];
    });
  }, []);
  const setQty = useCallback((variantId: string, quantity: number) => {
    setItems((prev) => (quantity <= 0 ? prev.filter((l) => l.variantId !== variantId) : prev.map((l) => (l.variantId === variantId ? { ...l, quantity } : l))));
  }, []);
  const remove = useCallback((variantId: string) => setItems((prev) => prev.filter((l) => l.variantId !== variantId)), []);
  const clear = useCallback(() => setItems([]), []);
  const count = items.reduce((s, l) => s + l.quantity, 0);

  const value = useMemo(() => ({ items, count, ready, add, setQty, remove, clear }), [items, count, ready, add, setQty, remove, clear]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}

export interface QuoteResult {
  lines: { variantId: string; productId: string; slug: string; title: string; image: string | null; uom: string; sku: string; attributes: Record<string, string> | null; unitPrice: number; mrp: number | null; quantity: number; lineTotal: number; stock: number; outOfStock: boolean; exceedsStock: boolean }[];
  subtotal: number;
  appliedDiscounts: { id: string; name: string; code: string | null; type: string; amount: number; freeShipping: boolean }[];
  totalDiscount: number;
  freeShipping: boolean;
  total: number;
  rejectedCoupons: { code: string; reason: string }[];
}

export async function fetchQuote(apiBaseUrl: string, storeSlug: string, items: CartLine[], couponCodes: string[]): Promise<QuoteResult | null> {
  if (!items.length) return null;
  try {
    const res = await fetch(`${apiBaseUrl}/storefront/${storeSlug}/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })), couponCodes }),
    });
    if (!res.ok) return null;
    return (await res.json()).data as QuoteResult;
  } catch { return null; }
}
