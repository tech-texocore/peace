"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api/client";

const KEY = "peace_wishlist";

interface WishlistContextValue {
  ids: string[];
  count: number;
  ready: boolean;
  has: (productId: string) => boolean;
  toggle: (productId: string) => void;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [ids, setIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const merged = useRef(false);

  useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setIds(JSON.parse(raw)); } catch {}
    setReady(true);
  }, []);
  useEffect(() => { if (ready) localStorage.setItem(KEY, JSON.stringify(ids)); }, [ids, ready]);

  // On sign-in, merge the guest wishlist into the account; on sign-out, allow a fresh merge next time.
  useEffect(() => {
    if (!user) { merged.current = false; return; }
    if (!ready || merged.current) return;
    merged.current = true;
    (async () => {
      try {
        const local = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
        const res = await api.post<{ productIds: string[] }>("/wishlist/merge", { productIds: local }, { auth: true });
        setIds(res.productIds);
      } catch { /* offline / not synced */ }
    })();
  }, [user, ready]);

  const has = useCallback((productId: string) => ids.includes(productId), [ids]);

  const toggle = useCallback((productId: string) => {
    setIds((prev) => {
      const on = prev.includes(productId);
      if (user) {
        (on ? api.delete(`/wishlist/items/${productId}`, { auth: true }) : api.post("/wishlist/items", { productId }, { auth: true })).catch(() => {});
      }
      return on ? prev.filter((x) => x !== productId) : [productId, ...prev];
    });
  }, [user]);

  const value = useMemo(() => ({ ids, count: ids.length, ready, has, toggle }), [ids, ready, has, toggle]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
