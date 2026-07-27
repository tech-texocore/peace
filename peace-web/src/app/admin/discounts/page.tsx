"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Pencil, Search, X, ChevronDown, Sparkles, Ticket, Tag } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field, Label } from "@/components/ui/form-fields";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { cn } from "@/lib/utils/cn";

type Method = "AUTOMATIC" | "CODE";
type DType = "PERCENTAGE" | "FIXED_AMOUNT" | "FREE_SHIPPING" | "BUY_X_GET_Y";
type Scope = "ALL" | "PRODUCTS" | "CATEGORIES" | "COLLECTIONS";
interface Opt { id: string; label: string }
interface Discount {
  id: string; name: string; method: Method; code?: string | null; type: DType; value: string;
  scope: Scope; targetProductIds: string[]; targetCategoryIds: string[]; targetCollectionIds: string[];
  minSubtotal?: string | null; minQuantity?: number | null; customerGroupIds: string[];
  buyQuantity?: number | null; getQuantity?: number | null; getDiscountPercent?: number | null;
  startsAt?: string | null; endsAt?: string | null; usageLimit?: number | null; perCustomerLimit?: number | null;
  priority: number; stackable: boolean; isActive: boolean; featuredInNewsletter: boolean; _count: { usages: number };
}

const emptyForm = {
  name: "", method: "AUTOMATIC" as Method, code: "", type: "PERCENTAGE" as DType, value: "",
  scope: "ALL" as Scope, targetProductIds: [] as string[], targetCategoryIds: [] as string[], targetCollectionIds: [] as string[],
  minSubtotal: "", minQuantity: "", customerGroupIds: [] as string[],
  buyQuantity: "2", getQuantity: "1", getDiscountPercent: "100",
  startsAt: "", endsAt: "", usageLimit: "", perCustomerLimit: "", priority: "0", stackable: false, isActive: true, featuredInNewsletter: false,
};

const TYPE_LABEL: Record<DType, string> = { PERCENTAGE: "% off", FIXED_AMOUNT: "₹ off", FREE_SHIPPING: "Free shipping", BUY_X_GET_Y: "Buy X Get Y" };
const toLocal = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", on ? "bg-accent" : "bg-black/15 dark:bg-white/20")}><span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform", on ? "translate-x-[22px]" : "translate-x-0.5")} /></button>;
}
function Select({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return <div className="relative"><select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full appearance-none rounded-lg border border-line bg-canvas px-3 pr-9 text-sm outline-none focus:border-accent">{children}</select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /></div>;
}
function Chips({ options, selected, onToggle, empty }: { options: Opt[]; selected: string[]; onToggle: (id: string) => void; empty: string }) {
  if (!options.length) return <p className="text-xs text-muted">{empty}</p>;
  return <div className="flex flex-wrap gap-1.5">{options.map((o) => { const on = selected.includes(o.id); return <button key={o.id} type="button" onClick={() => onToggle(o.id)} className={cn("rounded-full border px-3 py-1.5 text-xs transition-colors", on ? "border-accent bg-accent text-accent-foreground" : "border-line hover:bg-accent-soft")}>{o.label}</button>; })}</div>;
}

export default function DiscountsPage() {
  const { storeId, hasPermission } = useAdminAuth();
  const confirm = useConfirm();
  const [rows, setRows] = useState<Discount[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Discount | "new" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Opt[]>([]);
  const [categories, setCategories] = useState<Opt[]>([]);
  const [collections, setCollections] = useState<Opt[]>([]);
  const [groups, setGroups] = useState<Opt[]>([]);

  const canCreate = hasPermission("discounts.create");
  const canUpdate = hasPermission("discounts.update");
  const canDelete = hasPermission("discounts.delete");
  const q = storeId ? `storeId=${storeId}` : "";
  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const params = new URLSearchParams(q);
    if (search) params.set("search", search);
    const res = await api.get<{ items: Discount[]; total: number }>(`/discounts?${params}`, { auth: true });
    setRows(res.items); setTotal(res.total); setLoading(false);
  }, [storeId, q, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!storeId) return;
    api.get<{ items: { id: string; title: string }[] }>(`/products?${q}&limit=100`, { auth: true }).then((r) => setProducts(r.items.map((p) => ({ id: p.id, label: p.title }))));
    api.get<{ items: { id: string; title: string }[] }>(`/collections?${q}&limit=100`, { auth: true }).then((r) => setCollections(r.items.map((c) => ({ id: c.id, label: c.title }))));
    api.get<{ items: { id: string; name: string }[] }>(`/customer-groups?${q}&limit=100`, { auth: true }).then((r) => setGroups(r.items.map((g) => ({ id: g.id, label: g.name }))));
    api.get<{ id: string; name: string; children: unknown[] }[]>(`/categories?${q}`, { auth: true }).then((tree) => {
      const flat: Opt[] = [];
      const walk = (nodes: { id: string; name: string; children: { id: string; name: string; children: unknown[] }[] }[], d = 0) => nodes.forEach((n) => { flat.push({ id: n.id, label: `${"— ".repeat(d)}${n.name}` }); walk(n.children as never, d + 1); });
      walk(tree as never); setCategories(flat);
    });
  }, [storeId, q]);

  function startCreate() { setEditing("new"); setForm(emptyForm); setError(null); }
  function startEdit(d: Discount) {
    setEditing(d);
    setForm({
      name: d.name, method: d.method, code: d.code ?? "", type: d.type, value: d.value != null ? String(d.value) : "",
      scope: d.scope, targetProductIds: d.targetProductIds, targetCategoryIds: d.targetCategoryIds, targetCollectionIds: d.targetCollectionIds,
      minSubtotal: d.minSubtotal != null ? String(d.minSubtotal) : "", minQuantity: d.minQuantity != null ? String(d.minQuantity) : "", customerGroupIds: d.customerGroupIds,
      buyQuantity: d.buyQuantity != null ? String(d.buyQuantity) : "2", getQuantity: d.getQuantity != null ? String(d.getQuantity) : "1", getDiscountPercent: d.getDiscountPercent != null ? String(d.getDiscountPercent) : "100",
      startsAt: toLocal(d.startsAt), endsAt: toLocal(d.endsAt), usageLimit: d.usageLimit != null ? String(d.usageLimit) : "", perCustomerLimit: d.perCustomerLimit != null ? String(d.perCustomerLimit) : "",
      priority: String(d.priority), stackable: d.stackable, isActive: d.isActive, featuredInNewsletter: d.featuredInNewsletter,
    });
    setError(null);
  }
  const toggleArr = (key: "targetProductIds" | "targetCategoryIds" | "targetCollectionIds" | "customerGroupIds", id: string) =>
    set({ [key]: form[key].includes(id) ? form[key].filter((x) => x !== id) : [...form[key], id] } as Partial<typeof form>);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const num = (v: string) => (v === "" ? undefined : Number(v));
    const iso = (v: string) => (v ? new Date(v).toISOString() : undefined);
    const isBogo = form.type === "BUY_X_GET_Y";
    const payload: Record<string, unknown> = {
      name: form.name, method: form.method, code: form.method === "CODE" ? form.code : undefined, type: form.type,
      value: form.type === "PERCENTAGE" || form.type === "FIXED_AMOUNT" ? num(form.value) ?? 0 : 0,
      scope: form.scope,
      targetProductIds: form.scope === "PRODUCTS" ? form.targetProductIds : [],
      targetCategoryIds: form.scope === "CATEGORIES" ? form.targetCategoryIds : [],
      targetCollectionIds: form.scope === "COLLECTIONS" ? form.targetCollectionIds : [],
      minSubtotal: num(form.minSubtotal), minQuantity: num(form.minQuantity), customerGroupIds: form.customerGroupIds,
      buyQuantity: isBogo ? num(form.buyQuantity) : undefined, getQuantity: isBogo ? num(form.getQuantity) : undefined, getDiscountPercent: isBogo ? num(form.getDiscountPercent) : undefined,
      startsAt: iso(form.startsAt), endsAt: iso(form.endsAt), usageLimit: num(form.usageLimit), perCustomerLimit: num(form.perCustomerLimit),
      priority: num(form.priority) ?? 0, stackable: form.stackable, isActive: form.isActive, featuredInNewsletter: form.featuredInNewsletter,
    };
    try {
      if (editing && editing !== "new") await api.patch(`/discounts/${editing.id}?${q}`, payload, { auth: true });
      else await api.post(`/discounts?${q}`, payload, { auth: true });
      setEditing(null); await load();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  async function remove(d: Discount) {
    const ok = await confirm({ title: `Delete “${d.name}”?`, message: "The discount will be removed. Discounts already used in orders can’t be deleted — turn them off instead.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await api.delete(`/discounts/${d.id}?${q}`, { auth: true });
      setRows((r) => r.filter((x) => x.id !== d.id));
    } catch (err) { await confirm({ title: "Cannot delete", message: (err as Error).message, confirmLabel: "OK" }); }
  }

  const summary = (d: Discount) => d.type === "PERCENTAGE" ? `${d.value}% off` : d.type === "FIXED_AMOUNT" ? `₹${d.value} off` : d.type === "FREE_SHIPPING" ? "Free shipping" : `Buy ${d.buyQuantity} get ${d.getQuantity}`;

  return (
    <div className="w-full">
      <PageHeader
        title="Discounts"
        description="Offers that apply automatically at checkout, or coupon codes customers type in. Set who they apply to and when they run."
        action={canCreate && <button onClick={startCreate} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90"><Plus className="h-4 w-4" /> New discount</button>}
      />

      <div className="mb-3 relative w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or code…" className="h-10 w-full rounded-full border border-line bg-card pl-9 pr-4 text-sm outline-none focus:border-accent" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Discount</th>
              <th className="px-5 py-3 font-semibold">Type</th>
              <th className="px-5 py-3 font-semibold">Used</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="p-0"><EmptyState icon={Tag} title={search ? "No matching discounts" : "No discounts yet"} description={search ? "Try a different name or code." : "Create an automatic offer or a coupon code to start running promotions."} action={!search && canCreate && <button onClick={startCreate} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90"><Plus className="h-4 w-4" /> New discount</button>} /></td></tr>
            ) : rows.map((d) => (
              <tr key={d.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">
                  <span className="flex items-center gap-2 font-medium">
                    {d.method === "CODE" ? <Ticket className="h-4 w-4 text-accent" /> : <Sparkles className="h-4 w-4 text-accent" />}{d.name}
                    {d.code && <span className="rounded bg-accent-soft px-1.5 py-0.5 font-mono text-xs text-accent">{d.code}</span>}
                  </span>
                </td>
                <td className="px-5 py-3 text-muted">{summary(d)}</td>
                <td className="px-5 py-3 text-muted">{d._count.usages}{d.usageLimit ? ` / ${d.usageLimit}` : ""}</td>
                <td className="px-5 py-3"><span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", d.isActive ? "bg-accent-soft text-accent" : "bg-danger/10 text-danger")}>{d.isActive ? "Active" : "Off"}</span></td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {canUpdate && <button onClick={() => startEdit(d)} className="rounded-lg p-1.5 hover:bg-accent-soft" title="Edit"><Pencil className="h-4 w-4" /></button>}
                    {canDelete && <button onClick={() => remove(d)} className="rounded-lg p-1.5 text-danger hover:bg-danger/10" title="Delete"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && rows.length > 0 && <p className="mt-3 text-sm text-muted">{total} discount{total === 1 ? "" : "s"}</p>}

      {editing && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} aria-label="Close" />
          <form onSubmit={submit} className="relative flex h-full w-[80vw] max-w-[900px] flex-col bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-6 py-4">
              <h2 className="font-display text-lg">{editing === "new" ? "New discount" : "Edit discount"}</h2>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-muted hover:bg-accent-soft"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><Field label="Name" required placeholder="e.g. Diwali Sale" value={form.name} onChange={(v) => set({ name: v })} /><span className="mt-1 block text-xs text-muted/70">Only you see this — helps you find the offer later.</span></label>
                <label className="block"><Label>How it applies</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([["AUTOMATIC", "Automatic", Sparkles], ["CODE", "Coupon code", Ticket]] as const).map(([m, label, Icon]) => (
                      <button key={m} type="button" onClick={() => set({ method: m })} className={cn("flex items-center gap-2 rounded-xl border p-2.5 text-sm", form.method === m ? "border-accent bg-accent-soft/40" : "border-line hover:bg-accent-soft/30")}><Icon className={cn("h-4 w-4", form.method === m ? "text-accent" : "text-muted")} />{label}</button>
                    ))}
                  </div>
                </label>
                {form.method === "CODE" && <Field label="Coupon code" required placeholder="e.g. PEACE10" value={form.code} onChange={(v) => set({ code: v.toUpperCase() })} />}
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">Discount</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block"><Label>Type</Label><Select value={form.type} onChange={(v) => set({ type: v as DType })}><option value="PERCENTAGE">Percentage (%)</option><option value="FIXED_AMOUNT">Fixed amount (₹)</option><option value="FREE_SHIPPING">Free shipping</option><option value="BUY_X_GET_Y">Buy X Get Y</option></Select></label>
                  {(form.type === "PERCENTAGE" || form.type === "FIXED_AMOUNT") && <Field label={form.type === "PERCENTAGE" ? "Percent off" : "Amount off (₹)"} value={form.value} onChange={(v) => set({ value: v })} placeholder="0" type="number" />}
                  {form.type === "BUY_X_GET_Y" && <>
                    <Field label="Buy this many" value={form.buyQuantity} onChange={(v) => set({ buyQuantity: v })} type="number" />
                    <Field label="Get this many" value={form.getQuantity} onChange={(v) => set({ getQuantity: v })} type="number" />
                    <Field label="Discount on the free items %" value={form.getDiscountPercent} onChange={(v) => set({ getDiscountPercent: v })} type="number" placeholder="100 = fully free" />
                    <p className="text-xs text-muted sm:col-span-2">Example: buy 2, get 1 at 100% off = classic “buy 2 get 1 free”.</p>
                  </>}
                </div>
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">Applies to</p>
                <div className="mb-3 max-w-xs"><Select value={form.scope} onChange={(v) => set({ scope: v as Scope })}><option value="ALL">Entire order</option><option value="PRODUCTS">Specific products</option><option value="CATEGORIES">Specific categories</option><option value="COLLECTIONS">Specific collections</option></Select></div>
                {form.scope === "PRODUCTS" && <Chips options={products} selected={form.targetProductIds} onToggle={(id) => toggleArr("targetProductIds", id)} empty="No products." />}
                {form.scope === "CATEGORIES" && <Chips options={categories} selected={form.targetCategoryIds} onToggle={(id) => toggleArr("targetCategoryIds", id)} empty="No categories." />}
                {form.scope === "COLLECTIONS" && <Chips options={collections} selected={form.targetCollectionIds} onToggle={(id) => toggleArr("targetCollectionIds", id)} empty="No collections." />}
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">Conditions</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Min. subtotal (₹)" value={form.minSubtotal} onChange={(v) => set({ minSubtotal: v })} type="number" placeholder="none" />
                  <Field label="Min. quantity" value={form.minQuantity} onChange={(v) => set({ minQuantity: v })} type="number" placeholder="none" />
                </div>
                <div className="mt-3"><Label>Customer groups <span className="font-normal normal-case text-muted/70">(empty = all customers)</span></Label>
                  <Chips options={groups} selected={form.customerGroupIds} onToggle={(id) => toggleArr("customerGroupIds", id)} empty="No customer groups yet." />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div><p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">Schedule</p>
                  <div className="space-y-3">
                    <label className="block"><Label>Starts</Label><input type="datetime-local" value={form.startsAt} onChange={(e) => set({ startsAt: e.target.value })} className="h-11 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" /></label>
                    <label className="block"><Label>Ends</Label><input type="datetime-local" value={form.endsAt} onChange={(e) => set({ endsAt: e.target.value })} className="h-11 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" /></label>
                  </div>
                </div>
                <div><p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">Usage & priority</p>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Total limit" value={form.usageLimit} onChange={(v) => set({ usageLimit: v })} type="number" placeholder="∞" />
                      <Field label="Per customer" value={form.perCustomerLimit} onChange={(v) => set({ perCustomerLimit: v })} type="number" placeholder="∞" />
                    </div>
                    <Field label="Priority" value={form.priority} onChange={(v) => set({ priority: v })} type="number" placeholder="0 — higher number is applied first" />
                    <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5"><div><p className="text-sm font-medium">Combine with other discounts</p><p className="text-xs text-muted">Off = this can&apos;t be used together with another offer</p></div><Toggle on={form.stackable} onChange={(v) => set({ stackable: v })} /></div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5"><div><p className="text-sm font-medium">Active</p><p className="text-xs text-muted">Off = saved but not applied</p></div><Toggle on={form.isActive} onChange={(v) => set({ isActive: v })} /></div>
              <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5"><div><p className="text-sm font-medium">Feature in newsletter signup</p><p className="text-xs text-muted">Shows this offer on the home newsletter banner (one offer at a time)</p></div><Toggle on={form.featuredInNewsletter} onChange={(v) => set({ featuredInNewsletter: v })} /></div>
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>

            <div className="flex items-center gap-3 border-t border-line px-6 py-4">
              <button type="submit" disabled={busy || !form.name.trim() || (form.method === "CODE" && !form.code.trim())} className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90 disabled:opacity-50">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} {editing === "new" ? "Create discount" : "Save changes"}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="text-sm text-muted hover:text-ink">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
