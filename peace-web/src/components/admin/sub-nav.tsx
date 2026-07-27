"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { cn } from "@/lib/utils/cn";

export function SubNav({ tabs }: { tabs: { href: string; label: string; permission?: string }[] }) {
  const { hasPermission } = useAdminAuth();
  const pathname = usePathname();
  const visible = tabs.filter((t) => !t.permission || hasPermission(t.permission));
  if (visible.length < 2) return null;

  return (
    <div className="mb-5 flex flex-wrap gap-2 border-b border-line pb-4">
      {visible.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link key={t.href} href={t.href} className={cn("rounded-full border px-4 py-1.5 text-sm transition-colors", active ? "border-accent bg-accent text-accent-foreground" : "border-line hover:bg-accent-soft")}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

export const ORDER_TABS = [
  { href: "/admin/orders", label: "Orders", permission: "orders.read" },
  { href: "/admin/returns", label: "Returns", permission: "orders.read" },
];
export const CUSTOMER_TABS = [
  { href: "/admin/customers", label: "Customers", permission: "customers.read" },
  { href: "/admin/customer-groups", label: "Customer Groups", permission: "customergroups.read" },
];
