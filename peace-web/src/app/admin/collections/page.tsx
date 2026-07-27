"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Pencil, Search, X, ChevronDown, Sparkles, Hand, Layers, Info } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field, Label } from "@/components/ui/form-fields";
import { ImageUpload } from "@/components/ui/image-upload";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { getMasterItems } from "@/lib/masters";
import { cn } from "@/lib/utils/cn";

type CType = "MANUAL" | "AUTO";
interface Condition { field: string; operator: string; value: string }
interface Rules { match: "ALL" | "ANY"; conditions: Condition[] }
interface Collection {
  id: string; title: string; slug: string; description?: string | null; imageUrl?: string | null;
  type: CType; rules?: Rules | null; sortOrder: string; metaTitle?: string | null; metaDescription?: string | null;
  position: number; isActive: boolean; _count: { productLinks: number };
}
interface Opt { value: string; label: string }

const SORTS: Opt[] = [
  { value: "MANUAL", label: "Manual order" },
  { value: "BEST_SELLING", label: "Best selling" },
  { value: "PRICE_ASC", label: "Price: low → high" },
  { value: "PRICE_DESC", label: "Price: high → low" },
  { value: "NEWEST", label: "Newest first" },
  { value: "OLDEST", label: "Oldest first" },
];

// field.value describes how the rule value is entered.
const RULE_FIELDS: { key: string; label: string; input: "text" | "number" | "category" | string }[] = [
  { key: "title", label: "Product title", input: "text" },
  { key: "tag", label: "Tag", input: "text" },
  { key: "category", label: "Category", input: "category" },
  { key: "brand", label: "Brand", input: "master:brand" },
  { key: "fabric", label: "Fabric", input: "master:fabric" },
  { key: "pattern", label: "Pattern", input: "master:pattern" },
  { key: "occasion", label: "Occasion", input: "master:occasion" },
  { key: "season", label: "Season", input: "master:season" },
  { key: "price", label: "Price (₹)", input: "number" },
];
const OP_LABELS: Record<string, string> = { eq: "is", ne: "is not", contains: "contains", gt: "greater than", lt: "less than" };
const opsFor = (input: string): string[] => (input === "number" ? ["eq", "gt", "lt"] : input === "text" ? ["contains", "eq"] : ["eq", "ne"]);

const emptyForm = {
  title: "", slug: "", description: "", imageUrl: "", type: "MANUAL" as CType, sortOrder: "MANUAL",
  metaTitle: "", metaDescription: "", isActive: true, rules: { match: "ALL", conditions: [] } as Rules,
};
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", on ? "bg-accent" : "bg-black/15 dark:bg-white/20")}>
      <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform", on ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

function Select({ value, onChange, children, className }: { value: string; onChange: (v: string) => void; children: React.ReactNode; className?: string }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className={cn("h-11 w-full appearance-none rounded-lg border border-line bg-canvas px-3 pr-9 text-sm outline-none focus:border-accent", className)}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

export default function CollectionsPage() {
  const { storeId, hasPermission } = useAdminAuth();
  const confirm = useConfirm();
  const [rows, setRows] = useState<Collection[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | CType>("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Collection | "new" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSeo, setShowSeo] = useState(false);
  const [categories, setCategories] = useState<Opt[]>([]);
  const [masterOpts, setMasterOpts] = useState<Record<string, Opt[]>>({});

  const canCreate = hasPermission("collections.create");
  const canUpdate = hasPermission("collections.update");
  const canDelete = hasPermission("collections.delete");
  const q = storeId ? `storeId=${storeId}` : "";

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const params = new URLSearchParams(q);
    if (search) params.set("search", search);
    if (typeFilter) params.set("type", typeFilter);
    const res = await api.get<{ items: Collection[]; total: number }>(`/collections?${params}`, { auth: true });
    setRows(res.items); setTotal(res.total); setLoading(false);
  }, [storeId, q, search, typeFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!storeId) return;
    api.get<{ id: string; name: string; slug: string; children: unknown[] }[]>(`/categories?${q}`, { auth: true }).then((tree) => {
      const flat: Opt[] = [];
      const walk = (nodes: { name: string; slug: string; children: { name: string; slug: string; children: unknown[] }[] }[], d = 0) =>
        nodes.forEach((n) => { flat.push({ value: n.slug, label: `${"— ".repeat(d)}${n.name}` }); walk(n.children as never, d + 1); });
      walk(tree as never);
      setCategories(flat);
    });
  }, [storeId, q]);

  async function ensureMaster(key: string) {
    if (masterOpts[key] || !storeId) return;
    const items = await getMasterItems(key, storeId);
    setMasterOpts((m) => ({ ...m, [key]: items.map((i) => ({ value: i.value, label: i.label })) }));
  }

  function startCreate() { setEditing("new"); setForm(emptyForm); setShowSeo(false); setError(null); }
  function startEdit(c: Collection) {
    setEditing(c);
    setForm({
      title: c.title, slug: c.slug, description: c.description ?? "", imageUrl: c.imageUrl ?? "", type: c.type,
      sortOrder: c.sortOrder, metaTitle: c.metaTitle ?? "", metaDescription: c.metaDescription ?? "", isActive: c.isActive,
      rules: c.rules ?? { match: "ALL", conditions: [] },
    });
    setShowSeo(!!(c.metaTitle || c.metaDescription)); setError(null);
    (c.rules?.conditions ?? []).forEach((cond) => { const f = RULE_FIELDS.find((x) => x.key === cond.field); if (f?.input.startsWith("master:")) ensureMaster(f.input.split(":")[1]); });
  }

  function setRules(patch: Partial<Rules>) { setForm((f) => ({ ...f, rules: { ...f.rules, ...patch } })); }
  function addCondition() { setRules({ conditions: [...form.rules.conditions, { field: "tag", operator: "contains", value: "" }] }); }
  function updateCondition(i: number, patch: Partial<Condition>) {
    setRules({ conditions: form.rules.conditions.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  }
  function removeCondition(i: number) { setRules({ conditions: form.rules.conditions.filter((_, j) => j !== i) }); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const payload = {
      title: form.title, slug: form.slug || undefined, description: form.description, imageUrl: form.imageUrl,
      type: form.type, sortOrder: form.sortOrder, metaTitle: form.metaTitle, metaDescription: form.metaDescription, isActive: form.isActive,
      rules: form.type === "AUTO" ? { match: form.rules.match, conditions: form.rules.conditions.filter((c) => c.value !== "") } : undefined,
    };
    try {
      if (editing && editing !== "new") await api.patch(`/collections/${editing.id}?${q}`, payload, { auth: true });
      else await api.post(`/collections?${q}`, payload, { auth: true });
      setEditing(null); await load();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  async function remove(c: Collection) {
    const ok = await confirm({ title: `Delete “${c.title}”?`, message: "The collection will be removed. Products are not deleted.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    await api.delete(`/collections/${c.id}?${q}`, { auth: true });
    setRows((r) => r.filter((x) => x.id !== c.id));
  }

  function valueInput(cond: Condition, i: number) {
    const f = RULE_FIELDS.find((x) => x.key === cond.field);
    if (!f) return null;
    if (f.input === "number") return <input type="number" value={cond.value} onChange={(e) => updateCondition(i, { value: e.target.value })} placeholder="e.g. 999" className="h-10 w-32 rounded-lg border border-line bg-card px-2.5 text-sm outline-none focus:border-accent" />;
    if (f.input === "category") return <Select value={cond.value} onChange={(v) => updateCondition(i, { value: v })} className="h-10 min-w-[160px]"><option value="">Select…</option>{categories.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>;
    if (f.input.startsWith("master:")) {
      const key = f.input.split(":")[1];
      const opts = masterOpts[key] ?? [];
      return <Select value={cond.value} onChange={(v) => updateCondition(i, { value: v })} className="h-10 min-w-[160px]"><option value="">Select…</option>{opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>;
    }
    return <input value={cond.value} onChange={(e) => updateCondition(i, { value: e.target.value })} placeholder="Type a value" className="h-10 min-w-[160px] flex-1 rounded-lg border border-line bg-card px-2.5 text-sm outline-none focus:border-accent" />;
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Collections"
        description="Curated product groups (e.g. Festive Edit) — build them by hand or with automatic rules."
        action={canCreate && <button onClick={startCreate} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90"><Plus className="h-4 w-4" /> New collection</button>}
      />

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search collections…" className="h-10 w-64 rounded-full border border-line bg-card pl-9 pr-4 text-sm outline-none focus:border-accent" />
        </div>
        <div className="relative">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "" | CType)} className="h-10 appearance-none rounded-full border border-line bg-card pl-4 pr-9 text-sm outline-none focus:border-accent">
            <option value="">All types</option>
            <option value="MANUAL">Manual</option>
            <option value="AUTO">Automated</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Collection</th>
              <th className="px-5 py-3 font-semibold">Type</th>
              <th className="px-5 py-3 font-semibold">Products</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="p-0">
                <EmptyState icon={Layers} title={search || typeFilter ? "No matching collections" : "No collections yet"} description={search || typeFilter ? "Try clearing your search or filter." : "Group products into a collection like Festive Edit — pick them by hand or set rules to fill it automatically."} action={!search && !typeFilter && canCreate && <button onClick={startCreate} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90"><Plus className="h-4 w-4" /> New collection</button>} />
              </td></tr>
            ) : rows.map((c) => (
              <tr key={c.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">
                  <span className="flex items-center gap-2 font-medium">
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
                    ) : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent"><Layers className="h-4 w-4" /></span>}
                    {c.title}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", c.type === "AUTO" ? "bg-accent-soft text-accent" : "bg-black/5 text-muted dark:bg-white/10")}>
                    {c.type === "AUTO" ? <Sparkles className="h-3 w-3" /> : <Hand className="h-3 w-3" />}{c.type === "AUTO" ? "Automated" : "Manual"}
                  </span>
                </td>
                <td className="px-5 py-3 text-muted">{c.type === "AUTO" ? "by rules" : c._count.productLinks}</td>
                <td className="px-5 py-3"><span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", c.isActive ? "bg-accent-soft text-accent" : "bg-danger/10 text-danger")}>{c.isActive ? "Active" : "Hidden"}</span></td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {canUpdate && <button onClick={() => startEdit(c)} className="rounded-lg p-1.5 hover:bg-accent-soft" title="Edit"><Pencil className="h-4 w-4" /></button>}
                    {canDelete && <button onClick={() => remove(c)} className="rounded-lg p-1.5 text-danger hover:bg-danger/10" title="Delete"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && rows.length > 0 && <p className="mt-3 text-sm text-muted">{total} collection{total === 1 ? "" : "s"}</p>}

      {editing && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} aria-label="Close" />
          <form onSubmit={submit} className="relative flex h-full w-[80vw] max-w-[1100px] flex-col bg-card shadow-2xl">
            <div className="flex items-start justify-between border-b border-line px-6 py-4">
              <div>
                <h2 className="font-display text-lg">{editing === "new" ? "New collection" : "Edit collection"}</h2>
                <p className="mt-0.5 text-xs text-muted">Group products to feature on the storefront.</p>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-muted hover:bg-accent-soft"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label="Title" required placeholder="e.g. Festive Edit" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
                  <p className="mt-1 text-xs text-muted">Web address: <span className="font-mono text-ink">/collections/{form.slug || slugify(form.title) || "…"}</span></p>
                </div>
                <Field label="Slug (optional)" placeholder="auto from title" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
                <label className="block"><Label>Product sort order</Label><Select value={form.sortOrder} onChange={(v) => setForm({ ...form, sortOrder: v })}>{SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</Select></label>
                <div className="sm:col-span-2"><Field label="Description (optional)" textarea placeholder="Shown on the collection page" value={form.description} onChange={(v) => setForm({ ...form, description: v })} /></div>
                <ImageUpload label="Banner image (optional)" value={form.imageUrl} folder="collections" onChange={(url) => setForm({ ...form, imageUrl: url })} hint="Recommended 1600 × 600px (wide banner) · JPG or PNG · under 5 MB" />
                <div className="flex h-fit items-center justify-between self-end rounded-lg border border-line px-3 py-2.5">
                  <div><p className="text-sm font-medium">Active</p><p className="text-xs text-muted">Show on the storefront</p></div>
                  <Toggle on={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
                </div>

                <div className="sm:col-span-2">
                  <Label>How are products added?</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {([{ t: "MANUAL", icon: Hand, title: "Manual", desc: "Hand-pick products yourself" }, { t: "AUTO", icon: Sparkles, title: "Automated", desc: "Auto-fill by matching rules" }] as const).map((o) => (
                      <button key={o.t} type="button" onClick={() => setForm({ ...form, type: o.t })}
                        className={cn("flex items-start gap-2 rounded-xl border p-3 text-left transition-colors", form.type === o.t ? "border-accent bg-accent-soft/40" : "border-line hover:bg-accent-soft/30")}>
                        <o.icon className={cn("mt-0.5 h-4 w-4", form.type === o.t ? "text-accent" : "text-muted")} />
                        <div><p className="text-sm font-medium">{o.title}</p><p className="text-xs text-muted">{o.desc}</p></div>
                      </button>
                    ))}
                  </div>
                </div>

                {form.type === "MANUAL" ? (
                  <div className="rounded-lg bg-accent-soft/40 p-3 text-xs leading-relaxed text-muted sm:col-span-2">
                    <Info className="mr-1 inline h-3.5 w-3.5 text-accent" /> You add products to a manual collection from each <b className="text-ink">product’s page</b> (once products exist). Save this collection first.
                  </div>
                ) : (
                  <div className="rounded-xl border border-line p-3 sm:col-span-2">
                    <div className="mb-3 flex items-center gap-2 text-sm">
                      A product is included when it matches
                      <Select value={form.rules.match} onChange={(v) => setRules({ match: v as "ALL" | "ANY" })} className="h-9 w-24"><option value="ALL">ALL</option><option value="ANY">ANY</option></Select>
                      of these rules:
                    </div>
                    <div className="space-y-2">
                      {form.rules.conditions.map((cond, i) => {
                        const f = RULE_FIELDS.find((x) => x.key === cond.field)!;
                        return (
                          <div key={i} className="flex flex-wrap items-center gap-2">
                            <Select value={cond.field} onChange={(v) => { const nf = RULE_FIELDS.find((x) => x.key === v)!; updateCondition(i, { field: v, operator: opsFor(nf.input)[0], value: "" }); if (nf.input.startsWith("master:")) ensureMaster(nf.input.split(":")[1]); }} className="h-10 w-40"><option value="" disabled>Field…</option>{RULE_FIELDS.map((rf) => <option key={rf.key} value={rf.key}>{rf.label}</option>)}</Select>
                            <Select value={cond.operator} onChange={(v) => updateCondition(i, { operator: v })} className="h-10 w-36">{opsFor(f.input).map((op) => <option key={op} value={op}>{OP_LABELS[op]}</option>)}</Select>
                            {valueInput(cond, i)}
                            <button type="button" onClick={() => removeCondition(i)} className="rounded-lg p-2 text-danger hover:bg-danger/10"><Trash2 className="h-4 w-4" /></button>
                          </div>
                        );
                      })}
                    </div>
                    <button type="button" onClick={addCondition} className="mt-3 inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-accent-soft"><Plus className="h-3.5 w-3.5" /> Add rule</button>
                    {form.rules.conditions.length === 0 && <p className="mt-2 text-xs text-muted">No rules yet — add at least one so products can match.</p>}
                  </div>
                )}

                <div className="rounded-xl border border-line sm:col-span-2">
                  <button type="button" onClick={() => setShowSeo((v) => !v)} className="flex w-full items-center gap-2 px-3 py-3 text-left">
                    {showSeo ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 -rotate-90 text-muted" />}
                    <span className="text-sm font-medium">SEO</span><span className="text-xs text-muted">optional</span>
                  </button>
                  {showSeo && (
                    <div className="space-y-4 border-t border-line px-3 py-4">
                      <Field label="Meta title" placeholder="Shown in Google / browser tab" value={form.metaTitle} onChange={(v) => setForm({ ...form, metaTitle: v })} />
                      <Field label="Meta description" textarea placeholder="Search-result summary" value={form.metaDescription} onChange={(v) => setForm({ ...form, metaDescription: v })} />
                    </div>
                  )}
                </div>

                {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-line px-6 py-4">
              <button type="submit" disabled={busy || !form.title.trim()} className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90 disabled:opacity-50">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} {editing === "new" ? "Create collection" : "Save changes"}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="text-sm text-muted hover:text-ink">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
