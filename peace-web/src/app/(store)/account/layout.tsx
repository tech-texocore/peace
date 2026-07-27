"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Loader2, LogOut, ShieldCheck, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { AuthForm } from "@/components/account/auth-form";
import { Container } from "@/components/layout/container";
import { cn } from "@/lib/utils/cn";

const tabs = [
  { href: "/account", label: "Profile" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/notifications", label: "Notifications" },
  { href: "/account/preferences", label: "Preferences" },
  { href: "/account/addresses", label: "Addresses" },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout, isAdmin, role } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;
  }
  if (!user) return <AuthForm />;

  // Admins/staff are not shoppers — send them to the admin panel, not a customer account.
  if (isAdmin) {
    return (
      <Container className="py-16">
        <div className="mx-auto max-w-md rounded-2xl border border-line bg-card p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent"><ShieldCheck className="h-6 w-6" /></div>
          <h1 className="font-display text-2xl font-medium">You’re signed in as {role === "SUPER_ADMIN" ? "Super Admin" : role === "STAFF" ? "Staff" : "Admin"}</h1>
          <p className="mt-2 text-sm text-muted">Manage the store from the admin panel. This customer account area is for shoppers.</p>
          <div className="mt-6 flex flex-col gap-2">
            <Link href="/admin" className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90">Go to Admin Panel <ArrowRight className="h-4 w-4" /></Link>
            <button onClick={() => logout()} className="inline-flex items-center justify-center gap-2 rounded-full border border-line px-6 py-3 text-sm font-medium hover:bg-accent-soft"><LogOut className="h-4 w-4" /> Sign out</button>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-6">
      <div className="mb-5 flex items-center justify-between gap-3 border-b border-line pb-3">
        <nav className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const active = t.href === "/account" ? pathname === t.href : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                replace
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  active ? "bg-accent text-accent-foreground" : "text-muted hover:bg-accent-soft hover:text-ink",
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
        <button onClick={() => logout()} className="flex shrink-0 items-center gap-2 rounded-full border border-line px-3 py-2 text-xs font-semibold uppercase tracking-widest text-muted hover:text-ink sm:px-4">
          <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Sign out</span>
        </button>
      </div>
      {children}
    </Container>
  );
}
