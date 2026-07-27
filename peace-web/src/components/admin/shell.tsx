"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, SlidersHorizontal, ShieldCheck, Users, Store, Plug, ScrollText, Palette, Building2, Database, FolderTree, Layers, Package, Tag, Ticket, Star, ShoppingCart, Boxes, Contact, LogOut, Loader2, Menu, X, Mail, Megaphone } from "lucide-react";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { cn } from "@/lib/utils/cn";

// Ordered as a setup → sell → configure flow: prerequisites first, then the catalog they feed,
// then day-to-day sales, then storefront look, then platform settings.
const navGroups: { title: string | null; items: { href: string; label: string; icon: typeof LayoutDashboard; permission: string | null }[] }[] = [
  { title: null, items: [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: null },
  ] },
  { title: "Set up", items: [
    { href: "/admin/sellers", label: "Sellers", icon: Building2, permission: "sellers.read" },
    { href: "/admin/categories", label: "Categories", icon: FolderTree, permission: "categories.read" },
    { href: "/admin/brands", label: "Brands", icon: Tag, permission: "brands.read" },
    { href: "/admin/masters", label: "Option lists", icon: Database, permission: "masters.read" },
  ] },
  { title: "Catalog", items: [
    { href: "/admin/products", label: "Products", icon: Package, permission: "products.read" },
    { href: "/admin/inventory", label: "Inventory", icon: Boxes, permission: "inventory.read" },
    { href: "/admin/collections", label: "Collections", icon: Layers, permission: "collections.read" },
  ] },
  { title: "Sales", items: [
    { href: "/admin/orders", label: "Orders", icon: ShoppingCart, permission: "orders.read" },
    { href: "/admin/reviews", label: "Reviews", icon: Star, permission: "reviews.read" },
    { href: "/admin/customers", label: "Customers", icon: Contact, permission: "customers.read" },
  ] },
  { title: "Marketing", items: [
    { href: "/admin/campaigns", label: "Campaigns", icon: Megaphone, permission: "campaigns.read" },
    { href: "/admin/discounts", label: "Discounts", icon: Ticket, permission: "discounts.read" },
    { href: "/admin/subscriptions", label: "Subscriptions", icon: Mail, permission: "subscriptions.read" },
  ] },
  { title: "Storefront", items: [
    { href: "/admin/config", label: "Site Config", icon: SlidersHorizontal, permission: "config.read" },
    { href: "/admin/theme", label: "Theme", icon: Palette, permission: "config.read" },
  ] },
  { title: "Settings & Access", items: [
    { href: "/admin/settings", label: "Site Settings", icon: Store, permission: "settings.read" },
    { href: "/admin/integrations", label: "Integrations", icon: Plug, permission: "integrations.read" },
    { href: "/admin/roles", label: "Roles & Permissions", icon: ShieldCheck, permission: "roles.read" },
    { href: "/admin/admins", label: "Admins", icon: Users, permission: "admins.read" },
    { href: "/admin/audit", label: "Audit Log", icon: ScrollText, permission: "audit.read" },
  ] },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, profile, logout, hasPermission } = useAdminAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (!loading && !profile && !isLogin) router.replace("/admin/login");
    if (!loading && profile && isLogin) router.replace("/admin");
  }, [loading, profile, isLogin, router]);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  if (isLogin) return <>{children}</>;

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  const groups = navGroups
    .map((g) => ({ ...g, items: g.items.filter((n) => !n.permission || hasPermission(n.permission)) }))
    .filter((g) => g.items.length > 0);

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname.startsWith(href));
  const currentTitle = groups.flatMap((g) => g.items).find((i) => isActive(i.href))?.label ?? "Admin";

  const navContent = (
    <nav className="flex-1 space-y-6 overflow-y-auto p-4">
      {groups.map((group, gi) => (
        <div key={gi} className="space-y-0.5">
          {group.title && <p className="mb-1.5 pl-10 pr-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted/60">{group.title}</p>}
          {group.items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive(item.href) ? "bg-accent text-accent-foreground" : "text-muted hover:bg-accent-soft hover:text-ink",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const userFooter = (
    <div className="border-t border-line p-4">
      <div className="mb-3 px-1">
        <p className="truncate text-sm font-medium">{profile.name ?? profile.email}</p>
        <p className="text-xs text-muted">{profile.role.replace("_", " ")}</p>
      </div>
      <button
        onClick={() => logout()}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-accent-soft hover:text-ink"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-card md:flex">
        <div className="flex h-14 items-center border-b border-line px-5">
          <Link href="/admin" className="font-display text-lg font-medium">
            Peace <span className="text-muted">Admin</span>
          </Link>
        </div>
        {navContent}
        {userFooter}
      </aside>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} aria-label="Close menu" />
          <div className="relative flex w-72 max-w-[85vw] flex-col border-r border-line bg-card shadow-2xl">
            <div className="flex h-14 items-center justify-between border-b border-line px-5">
              <Link href="/admin" className="font-display text-lg font-medium">Peace <span className="text-muted">Admin</span></Link>
              <button onClick={() => setDrawerOpen(false)} className="rounded-lg p-1.5 text-muted hover:bg-accent-soft"><X className="h-5 w-5" /></button>
            </div>
            {navContent}
            {userFooter}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-line px-4 lg:px-6">
          <button onClick={() => setDrawerOpen(true)} className="rounded-lg p-2 hover:bg-accent-soft md:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="truncate font-display text-base font-medium md:hidden">{currentTitle}</h1>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="hidden text-muted sm:inline">{profile.store?.name ?? "Platform"}</span>
            <button onClick={() => logout()} className="rounded-lg p-2 hover:bg-accent-soft md:hidden" aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>
        <main className="flex-1 p-5 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
