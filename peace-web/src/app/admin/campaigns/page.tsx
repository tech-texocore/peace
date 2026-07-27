"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Pencil, Send, Megaphone, Mail, MessageSquare, Smartphone, Bell, Users, ChevronDown, ArrowLeft, Search, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field, Label } from "@/components/ui/form-fields";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { cn } from "@/lib/utils/cn";

interface Campaign { id: string; name: string; channels: string[]; subject: string | null; body: string; audience: Record<string, string> | null; targetUrl: string | null; productIds: string[]; status: string; recipientCount: number; sentAt: string | null; scheduledAt: string | null }
interface Opt { id: string; name?: string; title?: string }

const CHANNELS: { key: string; label: string; icon: typeof Mail; note?: string }[] = [
  { key: "EMAIL", label: "Email", icon: Mail },
  { key: "SMS", label: "SMS", icon: Smartphone, note: "needs SMS key" },
  { key: "WHATSAPP", label: "WhatsApp", icon: MessageSquare, note: "needs WhatsApp key" },
  { key: "IN_APP", label: "In-app", icon: Bell },
];
const AUDIENCES: [string, string][] = [["all_customers", "All customers"], ["newsletter", "Newsletter subscribers"], ["customer_group", "A customer group"], ["has_ordered", "Customers who ordered"]];
const LINKS: [string, string][] = [["", "No link"], ["/products", "Shop all"], ["/products?category=formal-shirts", "Formal shirts"], ["/products?category=casual-shirts", "Casual shirts"], ["/offers", "Offers"]];

const empty = { name: "", channels: ["EMAIL"] as string[], subject: "", body: "", base: "all_customers", groupId: "", state: "", targetUrl: "", productIds: [] as string[] };

function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return <div className="relative"><select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full appearance-none rounded-lg border border-line bg-canvas px-3 pr-9 text-sm outline-none focus:border-accent">{children}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /></div>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-line bg-card p-5"><h2 className="mb-4 font-display text-lg">{title}</h2><div className="space-y-4">{children}</div></section>;
}

export default function CampaignsPage() {
  const { storeId, hasPermission } = useAdminAuth();
  const confirm = useConfirm();
  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Campaign | "new" | null>(null);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<Opt[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<Opt[]>([]);
  const [productMap, setProductMap] = useState<Record<string, string>>({});
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderMsg, setReminderMsg] = useState<string | null>(null);

  const q = storeId ? `storeId=${storeId}` : "";
  const canCreate = hasPermission("campaigns.create");
  const canUpdate = hasPermission("campaigns.update");
  const canDelete = hasPermission("campaigns.delete");
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  async function runCartReminders() {
    setReminderBusy(true);
    setReminderMsg(null);
    try {
      const res = await api.post<{ reminded: number }>(`/engagement/abandoned-cart/scan?${q}`, {}, { auth: true });
      setReminderMsg(res.reminded > 0 ? `Reminded ${res.reminded} shopper${res.reminded === 1 ? "" : "s"} with items left in cart.` : "No abandoned carts to remind right now.");
    } catch {
      setReminderMsg("Couldn't run cart reminders.");
    } finally {
      setReminderBusy(false);
    }
  }

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try { setRows(await api.get<Campaign[]>(`/campaigns?${q}`, { auth: true })); }
    finally { setLoading(false); }
  }, [storeId, q]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!storeId) return;
    api.get<{ items: Opt[] }>(`/customer-groups?${q}`, { auth: true }).then((r) => setGroups(r.items)).catch(() => {});
    api.get<{ facets?: { states: string[] } }>(`/customers?${q}&limit=1`, { auth: true }).then((r) => setStates(r.facets?.states ?? [])).catch(() => {});
  }, [storeId, q]);

  useEffect(() => {
    if (!editing || !storeId) return;
    const t = setTimeout(() => {
      const p = new URLSearchParams(q); p.set("limit", "12"); if (productQuery) p.set("search", productQuery);
      api.get<{ items: Opt[] }>(`/products?${p}`, { auth: true }).then((r) => {
        setProductResults(r.items);
        setProductMap((m) => ({ ...m, ...Object.fromEntries(r.items.map((x) => [x.id, x.title ?? ""])) }));
      }).catch(() => {});
    }, 250);
    return () => clearTimeout(t);
  }, [editing, storeId, q, productQuery]);

  useEffect(() => {
    if (!editing || !storeId) return;
    const t = setTimeout(() => {
      api.post<{ count: number }>(`/campaigns/audience-count?${q}`, { base: form.base, groupId: form.groupId || undefined, state: form.state || undefined }, { auth: true })
        .then((r) => setCount(r.count)).catch(() => setCount(null));
    }, 250);
    return () => clearTimeout(t);
  }, [editing, storeId, q, form.base, form.groupId, form.state]);

  function startCreate() { setEditing("new"); setForm(empty); setCount(null); setError(null); }
  function startEdit(c: Campaign) {
    setEditing(c);
    setForm({ name: c.name, channels: c.channels, subject: c.subject ?? "", body: c.body, base: c.audience?.base ?? "all_customers", groupId: c.audience?.groupId ?? "", state: c.audience?.state ?? "", targetUrl: c.targetUrl ?? "", productIds: c.productIds });
    setError(null);
  }
  const toggleChannel = (k: string) => set({ channels: form.channels.includes(k) ? form.channels.filter((x) => x !== k) : [...form.channels, k] });
  const toggleProduct = (id: string) => set({ productIds: form.productIds.includes(id) ? form.productIds.filter((x) => x !== id) : [...form.productIds, id] });

  function payload() {
    return { name: form.name, channels: form.channels, subject: form.subject || undefined, body: form.body, audience: { base: form.base, groupId: form.groupId || undefined, state: form.state || undefined }, targetUrl: form.targetUrl || undefined, productIds: form.productIds };
  }
  async function save(): Promise<Campaign | null> {
    setBusy(true); setError(null);
    try {
      const c = editing && editing !== "new" ? await api.patch<Campaign>(`/campaigns/${editing.id}?${q}`, payload(), { auth: true }) : await api.post<Campaign>(`/campaigns?${q}`, payload(), { auth: true });
      await load();
      return c;
    } catch (err) { setError((err as Error).message); return null; }
    finally { setBusy(false); }
  }
  async function saveDraft() { if (await save()) setEditing(null); }
  async function sendNow() {
    if (!form.channels.length) { setError("Pick at least one channel."); return; }
    const c = await save();
    if (!c) return;
    const ok = await confirm({ title: "Send this campaign now?", message: `It will go to ${count ?? "the selected"} recipient${count === 1 ? "" : "s"} on: ${form.channels.map((ch) => CHANNELS.find((x) => x.key === ch)?.label).join(", ")}.`, confirmLabel: "Send now" });
    if (!ok) return;
    setBusy(true);
    try { const res = await api.post<{ sent: number }>(`/campaigns/${c.id}/send?${q}`, {}, { auth: true }); setEditing(null); await load(); await confirm({ title: "Campaign sent", message: `Delivered to ${res.sent} recipient${res.sent === 1 ? "" : "s"}.`, confirmLabel: "Done" }); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  async function remove(c: Campaign) {
    const ok = await confirm({ title: `Delete “${c.name}”?`, message: "The campaign will be removed.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try { await api.delete(`/campaigns/${c.id}?${q}`, { auth: true }); setRows((r) => r.filter((x) => x.id !== c.id)); }
    catch (err) { await confirm({ title: "Cannot delete", message: (err as Error).message, confirmLabel: "OK" }); }
  }

  const statusPill = (s: string) => s === "SENT" ? "bg-accent-soft text-accent" : s === "SCHEDULED" ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-black/5 text-muted dark:bg-white/10";
  const canSend = !busy && !!form.name.trim() && !!form.body.trim() && form.channels.length > 0;

  // ── Full-screen builder ──
  if (editing) {
    const preview = (form.body || "Your message will appear here.").replace(/\{name\}/g, "there");
    const chosenProducts = form.productIds.map((id) => ({ id, title: productMap[id] ?? "Product" }));
    const results = productResults.filter((p) => !form.productIds.includes(p.id));
    return (
      <div className="w-full">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <button onClick={() => setEditing(null)} className="mb-1 flex items-center gap-1 text-xs text-muted hover:text-accent"><ArrowLeft className="h-3.5 w-3.5" /> Back to campaigns</button>
            <h1 className="font-display text-2xl font-medium">{editing === "new" ? "New campaign" : "Edit campaign"}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setEditing(null)} className="text-sm text-muted hover:text-ink">Cancel</button>
            <button onClick={saveDraft} disabled={busy || !form.name.trim()} className="rounded-full border border-line px-5 py-2.5 text-xs font-semibold uppercase tracking-widest hover:bg-accent-soft disabled:opacity-50">Save draft</button>
            <button onClick={sendNow} disabled={!canSend} className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90 disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send now</button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          <div className="space-y-6">
            <Card title="Basics">
              <Field label="Campaign name" required placeholder="e.g. Diwali launch" value={form.name} onChange={(v) => set({ name: v })} />
              <div>
                <Label>Channels</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CHANNELS.map((ch) => { const on = form.channels.includes(ch.key); const Icon = ch.icon; return (
                    <button key={ch.key} type="button" onClick={() => toggleChannel(ch.key)} className={cn("flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm", on ? "border-accent bg-accent-soft/40" : "border-line hover:bg-accent-soft/30")}>
                      <Icon className={cn("h-5 w-5", on ? "text-accent" : "text-muted")} />{ch.label}{ch.note && <span className="text-[10px] text-muted/70">{ch.note}</span>}
                    </button>
                  ); })}
                </div>
              </div>
            </Card>

            <Card title="Audience">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block"><Label>Send to</Label><Select value={form.base} onChange={(v) => set({ base: v })}>{AUDIENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></label>
                {form.base === "customer_group" ? (
                  <label className="block"><Label>Group</Label><Select value={form.groupId} onChange={(v) => set({ groupId: v })}><option value="">Select a group…</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</Select></label>
                ) : (
                  <label className="block"><Label>Location</Label><Select value={form.state} onChange={(v) => set({ state: v })}><option value="">All locations</option>{states.map((s) => <option key={s} value={s}>{s}</option>)}</Select></label>
                )}
              </div>
              <p className="flex items-center gap-1.5 rounded-lg bg-accent-soft/50 px-3 py-2 text-xs text-muted"><Users className="h-3.5 w-3.5 text-accent" /> {count == null ? "Estimating reach…" : <><span className="font-semibold text-ink">{count}</span>&nbsp;recipient{count === 1 ? "" : "s"} · only opted-in contacts get each channel</>}</p>
            </Card>

            <Card title="Message">
              <Field label="Subject" placeholder="Shown in email & in-app" value={form.subject} onChange={(v) => set({ subject: v })} />
              <div><Label>Message <span className="font-normal normal-case text-muted/70">— use {"{name}"} to personalise</span></Label><textarea rows={6} value={form.body} onChange={(e) => set({ body: e.target.value })} placeholder="Hi {name}, our new white shirts just dropped…" className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent" /></div>
              <label className="block"><Label>Button link <span className="font-normal normal-case text-muted/70">(where the CTA goes)</span></Label><Select value={form.targetUrl} onChange={(v) => set({ targetUrl: v })}>{LINKS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select></label>
              <div>
                <Label>Suggested products <span className="font-normal normal-case text-muted/70">(optional)</span></Label>
                {chosenProducts.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {chosenProducts.map((p) => (
                      <button key={p.id} type="button" onClick={() => toggleProduct(p.id)} className="inline-flex items-center gap-1 rounded-full border border-accent bg-accent px-3 py-1.5 text-xs text-accent-foreground">{p.title}<X className="h-3 w-3" /></button>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input value={productQuery} onChange={(e) => setProductQuery(e.target.value)} placeholder="Search products to add…" className="h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-sm outline-none focus:border-accent" />
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {results.length === 0 ? <span className="text-xs text-muted">{productQuery ? "No matches." : "Start typing to find products."}</span>
                    : results.map((p) => <button key={p.id} type="button" onClick={() => toggleProduct(p.id)} className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs hover:bg-accent-soft"><Plus className="h-3 w-3" />{p.title}</button>)}
                </div>
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
            </Card>
          </div>

          <div className="space-y-4 lg:sticky lg:top-6">
            <div className="rounded-2xl border border-line bg-card p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted/70">Preview</p>
              <div className="rounded-xl border border-line bg-canvas p-5">
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {form.channels.map((ch) => { const c = CHANNELS.find((x) => x.key === ch); if (!c) return null; const Icon = c.icon; return <span key={ch} className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent"><Icon className="h-3 w-3" />{c.label}</span>; })}
                  {!form.channels.length && <span className="text-xs text-muted">Pick a channel</span>}
                </div>
                <h3 className="font-display text-lg leading-snug">{form.subject || form.name || "Your subject"}</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{preview}</p>
                {form.targetUrl && <span className="mt-4 inline-block rounded-full bg-accent px-4 py-2 text-xs font-semibold text-accent-foreground">Shop now →</span>}
                {chosenProducts.length > 0 && (
                  <div className="mt-4 border-t border-line pt-3">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted/70">Featured</p>
                    <div className="flex flex-wrap gap-1.5">{chosenProducts.map((p) => <span key={p.id} className="rounded-full border border-line px-2.5 py-1 text-xs">{p.title}</span>)}</div>
                  </div>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-line bg-card p-4 text-sm">
              <div className="flex items-center justify-between"><span className="text-muted">Recipients</span><span className="font-medium">{count ?? "—"}</span></div>
              <div className="mt-1 flex items-center justify-between"><span className="text-muted">Channels</span><span className="font-medium">{form.channels.length || "—"}</span></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── List ──
  return (
    <div className="w-full">
      <PageHeader title="Campaigns" description="Send marketing messages to your customers over email, SMS, WhatsApp or in-app. Pick an audience, write once, send everywhere." action={canCreate && <button onClick={startCreate} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90"><Plus className="h-4 w-4" /> New campaign</button>} />

      {canUpdate && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card p-5">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div>
              <p className="text-sm font-semibold">Automated cart reminders</p>
              <p className="text-xs text-muted">Shoppers who leave items in their cart get a nudge automatically every hour. Run it now to catch any waiting carts immediately.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {reminderMsg && <span className="text-xs text-muted">{reminderMsg}</span>}
            <button onClick={runCartReminders} disabled={reminderBusy} className="flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-xs font-semibold uppercase tracking-widest hover:bg-accent-soft disabled:opacity-50">
              {reminderBusy && <Loader2 className="h-4 w-4 animate-spin" />} Run cart reminders
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Megaphone} title="No campaigns yet" description="Create a campaign to reach your customers with offers, launches and updates." action={canCreate && <button onClick={startCreate} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90"><Plus className="h-4 w-4" /> New campaign</button>} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted"><th className="px-5 py-3 font-semibold">Campaign</th><th className="px-5 py-3 font-semibold">Channels</th><th className="px-5 py-3 font-semibold">Sent to</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3" /></tr></thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0">
                  <td className="px-5 py-3"><span className="font-medium">{c.name}</span>{c.sentAt && <span className="block text-xs text-muted">{new Date(c.sentAt).toLocaleDateString("en-IN")}</span>}</td>
                  <td className="px-5 py-3 text-muted">{c.channels.map((ch) => CHANNELS.find((x) => x.key === ch)?.label ?? ch).join(" · ") || "—"}</td>
                  <td className="px-5 py-3 text-muted">{c.status === "SENT" ? c.recipientCount : "—"}</td>
                  <td className="px-5 py-3"><span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", statusPill(c.status))}>{c.status.toLowerCase()}</span></td>
                  <td className="px-5 py-3"><div className="flex items-center justify-end gap-1">{canUpdate && c.status !== "SENT" && <button onClick={() => startEdit(c)} className="rounded-lg p-1.5 hover:bg-accent-soft" title="Edit"><Pencil className="h-4 w-4" /></button>}{canDelete && <button onClick={() => remove(c)} className="rounded-lg p-1.5 text-danger hover:bg-danger/10" title="Delete"><Trash2 className="h-4 w-4" /></button>}</div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
