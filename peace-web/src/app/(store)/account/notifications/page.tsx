"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/api/client";

interface Note { id: string; title: string; body: string; deepLink: string | null; read: boolean; createdAt: string }

const when = (s: string) => {
  const d = new Date(s), diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3600) return `${Math.max(1, Math.floor(diff / 60))}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Note[] | null>(null);

  async function load() {
    const res = await api.get<{ items: Note[] }>("/account/notifications", { auth: true });
    setItems(res.items);
  }
  useEffect(() => { load().catch(() => setItems([])); }, []);

  async function markRead(id: string) {
    setItems((its) => its?.map((n) => (n.id === id ? { ...n, read: true } : n)) ?? its);
    await api.patch(`/account/notifications/${id}/read`, {}, { auth: true }).catch(() => {});
  }
  async function markAll() {
    setItems((its) => its?.map((n) => ({ ...n, read: true })) ?? its);
    await api.post("/account/notifications/read-all", {}, { auth: true }).catch(() => {});
  }

  const unread = (items ?? []).filter((n) => !n.read).length;

  if (items === null) return <div className="flex h-48 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div><h1 className="flex items-center gap-2 font-display text-xl font-medium"><Bell className="h-5 w-5" /> Notifications</h1><p className="text-sm text-muted">{unread > 0 ? `${unread} unread` : "You're all caught up."}</p></div>
        {unread > 0 && <button onClick={markAll} className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-xs font-medium hover:bg-accent-soft"><CheckCheck className="h-4 w-4" /> Mark all read</button>}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-16 text-center">
          <Bell className="mx-auto h-8 w-8 text-muted/40" />
          <p className="mt-3 text-sm text-muted">No notifications yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-line rounded-2xl border border-line">
          {items.map((n) => {
            const inner = (
              <div className="flex gap-3 p-4">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-accent"}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.read ? "font-medium" : "font-semibold"}`}>{n.title}</p>
                  <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                  <p className="mt-1 text-xs text-muted/70">{when(n.createdAt)}</p>
                </div>
              </div>
            );
            return n.deepLink ? (
              <Link key={n.id} href={n.deepLink} onClick={() => markRead(n.id)} className="block transition-colors hover:bg-accent-soft/30">{inner}</Link>
            ) : (
              <button key={n.id} onClick={() => markRead(n.id)} className="block w-full text-left transition-colors hover:bg-accent-soft/30">{inner}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}
