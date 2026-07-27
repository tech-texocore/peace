"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, ShoppingBag, Heart, User, Bell } from "lucide-react";
import { Container } from "./container";
import { SearchBar } from "./search-bar";
import type { SiteConfig } from "@/lib/site-config";
import { cn } from "@/lib/utils/cn";
import { control } from "@/lib/tokens";
import { useCart } from "@/lib/cart";
import { useWishlist } from "@/lib/wishlist";
import { useAuth } from "@/context/auth-context";
import { api } from "@/lib/api/client";

export function Header({ config }: { config: SiteConfig }) {
  const [open, setOpen] = useState(false);
  const { brand, nav } = config;
  const { count: cartCount } = useCart();
  const { count: wishCount } = useWishlist();
  const { isAdmin, user } = useAuth();
  const [noteCount, setNoteCount] = useState(0);
  useEffect(() => {
    if (!user || isAdmin) { setNoteCount(0); return; }
    api.get<{ count: number }>("/account/notifications/unread-count", { auth: true }).then((r) => setNoteCount(r.count)).catch(() => {});
  }, [user, isAdmin]);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-canvas/85 backdrop-blur">
      <Container className="flex h-14 items-center justify-between gap-4 lg:h-16">
        <div className="flex items-center gap-6">
          <button
            type="button"
            aria-label="Toggle menu"
            onClick={() => setOpen((v) => !v)}
            className="-ml-2 rounded-full p-2 hover:bg-accent-soft lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/" className="font-display text-xl font-medium tracking-tight lg:text-2xl">
            {brand.name}
          </Link>
        </div>

        <nav className="hidden items-center gap-9 lg:flex">
          {nav.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs font-semibold uppercase tracking-widest text-muted transition-colors hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <SearchBar />
          <Link href="/wishlist" aria-label="Wishlist" className={cn(control.iconButton, "relative hidden sm:block")}>
            <Heart className="h-5 w-5" />
            {wishCount > 0 && (
              <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
                {wishCount}
              </span>
            )}
          </Link>
          {user && !isAdmin && (
            <Link href="/account/notifications" aria-label="Notifications" className={cn(control.iconButton, "relative hidden sm:block")}>
              <Bell className="h-5 w-5" />
              {noteCount > 0 && (
                <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">{noteCount}</span>
              )}
            </Link>
          )}
          <Link href={isAdmin ? "/admin" : "/account"} aria-label={isAdmin ? "Admin panel" : "Account"} className={cn(control.iconButton, "hidden sm:block")}>
            <User className="h-5 w-5" />
          </Link>
          <Link href="/cart" aria-label="Cart" className={cn(control.iconButton, "relative")}>
            <ShoppingBag className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </Container>

      <div
        className={cn(
          "overflow-hidden border-t border-line transition-all lg:hidden",
          open ? "max-h-72" : "max-h-0",
        )}
      >
        <Container className="flex flex-col py-2">
          {nav.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="border-b border-line py-3.5 text-sm font-medium uppercase tracking-wide last:border-0"
            >
              {link.label}
            </Link>
          ))}
        </Container>
      </div>
    </header>
  );
}
