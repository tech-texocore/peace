"use client";

import Link from "next/link";
import { SlidersHorizontal, ShieldCheck, Users, Store, Plug, ScrollText, Palette, Building2, Database, FolderTree, Layers, Package, Tag, UsersRound, Ticket, ArrowRight } from "lucide-react";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { DashboardStats } from "@/components/admin/dashboard-stats";

export default function AdminDashboard() {
  const { profile, hasPermission } = useAdminAuth();

  const cards = [
    { href: "/admin/sellers", title: "Sellers", desc: "Businesses that list products on your platform.", icon: Building2, permission: "sellers.read" },
    { href: "/admin/products", title: "Products", desc: "Your catalog — products, variants, pricing.", icon: Package, permission: "products.read" },
    { href: "/admin/masters", title: "Option lists", desc: "Reusable dropdowns — sizes, colours, fabrics.", icon: Database, permission: "masters.read" },
    { href: "/admin/categories", title: "Categories", desc: "Catalog hierarchy — category → sub-category.", icon: FolderTree, permission: "categories.read" },
    { href: "/admin/brands", title: "Brands", desc: "Brands you stock — logo, page, products.", icon: Tag, permission: "brands.read" },
    { href: "/admin/collections", title: "Collections", desc: "Curated product groups — manual or automated.", icon: Layers, permission: "collections.read" },
    { href: "/admin/customer-groups", title: "Customer Groups", desc: "Segments for group-specific pricing.", icon: UsersRound, permission: "customergroups.read" },
    { href: "/admin/discounts", title: "Discounts", desc: "Offers & coupons — %, flat, free-ship, BOGO.", icon: Ticket, permission: "discounts.read" },
    { href: "/admin/config", title: "Site Config", desc: "Edit the storefront home — brand, hero, sections.", icon: SlidersHorizontal, permission: "config.read" },
    { href: "/admin/theme", title: "Theme", desc: "Brand accent colours for the storefront.", icon: Palette, permission: "config.read" },
    { href: "/admin/settings", title: "Site Settings", desc: "Site brand, contact & policies.", icon: Store, permission: "settings.read" },
    { href: "/admin/integrations", title: "Integrations", desc: "Razorpay, BlueDart, WhatsApp & SMS keys.", icon: Plug, permission: "integrations.read" },
    { href: "/admin/roles", title: "Roles & Permissions", desc: "Configure what each role can access.", icon: ShieldCheck, permission: "roles.read" },
    { href: "/admin/admins", title: "Admins", desc: "Create and manage admin accounts.", icon: Users, permission: "admins.read" },
    { href: "/admin/audit", title: "Audit Log", desc: "Every admin action — who did what, when.", icon: ScrollText, permission: "audit.read" },
  ].filter((c) => hasPermission(c.permission));

  const quickActions = [
    { href: "/admin/products/new", label: "Add product", permission: "products.create", primary: true },
    { href: "/admin/orders", label: "Orders", permission: "orders.read" },
    { href: "/admin/inventory", label: "Inventory", permission: "inventory.read" },
    { href: "/admin/discounts", label: "Discounts", permission: "discounts.read" },
  ].filter((a) => hasPermission(a.permission));

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium">Welcome{profile?.name ? `, ${profile.name}` : ""}</h1>
          <p className="mt-1 text-sm text-muted">
            Signed in as <span className="font-medium text-ink">{profile?.role.replace("_", " ")}</span>
            {profile?.store?.name ? ` · ${profile.store.name}` : " · Platform"}
          </p>
        </div>
        {quickActions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {quickActions.map((a) => (
              <Link key={a.href} href={a.href} className={a.primary
                ? "rounded-full bg-accent px-4 py-2 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90"
                : "rounded-full border border-line px-4 py-2 text-xs font-semibold uppercase tracking-widest text-muted hover:bg-accent-soft hover:text-ink"}>
                {a.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <DashboardStats />

      {cards.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-[0.14em] text-muted/70">Manage your store</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <Link key={c.href} href={c.href} className="group flex items-start gap-3 rounded-xl border border-line bg-card p-4 transition-colors hover:border-accent">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent"><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-1 font-medium">{c.title}<ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-accent opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" /></span>
                    <span className="mt-0.5 block text-xs leading-snug text-muted">{c.desc}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
