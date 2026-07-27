"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2, Plus, Trash2, Pencil, ChevronRight, ChevronDown, FolderTree, Folder, FolderOpen,
  Search, X, ChevronUp, CornerDownRight, Layers, Tag, Info,
} from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field, Label } from "@/components/ui/form-fields";
import { ImageUpload } from "@/components/ui/image-upload";
import { cn } from "@/lib/utils/cn";

interface Category {
  id: string; name: string; slug: string; path?: string | null; parentId?: string | null;
  description?: string | null; imageUrl?: string | null; attributeKeys: string[]; variantAxisKeys: string[];
  position: number; isActive: boolean; _count: { products: number; children: number }; children: Category[];
}
interface MasterKey { key: string; label: string; usage: string[] }
type Editing = { category?: Category; parentId?: string | null } | null;

const emptyForm = { name: "", slug: "", description: "", imageUrl: "", parentId: "" as string, attributeKeys: [] as string[], variantAxisKeys: [] as string[], isActive: true };
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function flatten(nodes: Category[], depth = 0): { c: Category; depth: number }[] {
  return nodes.flatMap((c) => [{ c, depth }, ...flatten(c.children, depth + 1)]);
}
function findNode(nodes: Category[], id: string): Category | null {
  for (const n of nodes) { if (n.id === id) return n; const f = findNode(n.children, id); if (f) return f; }
  return null;
}
function filterTree(nodes: Category[], q: string): Category[] {
  if (!q) return nodes;
  const ql = q.toLowerCase();
  return nodes
    .map((n) => ({ ...n, children: filterTree(n.children, q) }))
    .filter((n) => n.name.toLowerCase().includes(ql) || n.children.length > 0);
}
function allIds(nodes: Category[]): string[] {
  return nodes.flatMap((n) => [n.id, ...allIds(n.children)]);
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", on ? "bg-accent" : "bg-black/15 dark:bg-white/20")}>
      <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform", on ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

function Chips({ options, selected, onToggle }: { options: MasterKey[]; selected: string[]; onToggle: (k: string) => void }) {
  if (options.length === 0) return <p className="text-xs text-muted">No masters configured for this. Add them in Masters.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selected.includes(o.key);
        return (
          <button key={o.key} type="button" onClick={() => onToggle(o.key)}
            className={cn("rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", on ? "border-accent bg-accent text-accent-foreground" : "border-line hover:bg-accent-soft")}>
            {on ? "✓ " : ""}{o.label}
          </button>
        );
      })}
    </div>
  );
}

export default function CategoriesPage() {
  const { storeId, hasPermission } = useAdminAuth();
  const confirm = useConfirm();
  const [tree, setTree] = useState<Category[]>([]);
  const [masterKeys, setMasterKeys] = useState<MasterKey[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Editing>(null);
  const [form, setForm] = useState(emptyForm);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = hasPermission("categories.create");
  const canUpdate = hasPermission("categories.update");
  const canDelete = hasPermission("categories.delete");
  const q = storeId ? `storeId=${storeId}` : "";

  const loadTree = useCallback(async () => {
    if (!storeId) return;
    setTree(await api.get<Category[]>(`/categories?${q}`, { auth: true }));
    setLoading(false);
  }, [storeId, q]);

  useEffect(() => { loadTree(); }, [loadTree]);
  useEffect(() => {
    if (storeId) api.get<MasterKey[]>(`/masters?${q}`, { auth: true }).then((ls) => setMasterKeys(ls.map((l) => ({ key: l.key, label: l.label, usage: l.usage ?? [] }))));
  }, [storeId, q]);

  const flat = useMemo(() => flatten(tree), [tree]);
  const visible = useMemo(() => filterTree(tree, search), [tree, search]);
  const totalCount = flat.length;

  function startCreate(parentId: string | null) {
    setEditing({ parentId });
    setForm({ ...emptyForm, parentId: parentId ?? "" });
    setShowAdvanced(false); setError(null);
    if (parentId) setExpanded((s) => new Set(s).add(parentId));
  }
  function startEdit(c: Category) {
    setEditing({ category: c });
    setForm({ name: c.name, slug: c.slug, description: c.description ?? "", imageUrl: c.imageUrl ?? "", parentId: c.parentId ?? "", attributeKeys: c.attributeKeys, variantAxisKeys: c.variantAxisKeys, isActive: c.isActive });
    setShowAdvanced(c.variantAxisKeys.length > 0 || c.attributeKeys.length > 0); setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const payload = { name: form.name, slug: form.slug || undefined, description: form.description, imageUrl: form.imageUrl, parentId: form.parentId || null, attributeKeys: form.attributeKeys, variantAxisKeys: form.variantAxisKeys, isActive: form.isActive };
    try {
      if (editing?.category) await api.patch(`/categories/${editing.category.id}?${q}`, payload, { auth: true });
      else await api.post(`/categories?${q}`, payload, { auth: true });
      setEditing(null);
      await loadTree();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  async function remove(c: Category) {
    const ok = await confirm({ title: `Delete “${c.name}”?`, message: c._count.products > 0 ? `${c._count.products} product(s) will be left uncategorised.` : "This category will be removed.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try { await api.delete(`/categories/${c.id}?${q}`, { auth: true }); await loadTree(); }
    catch (err) { await confirm({ title: "Cannot delete", message: (err as Error).message, confirmLabel: "OK" }); }
  }

  async function move(c: Category, dir: "up" | "down") {
    const siblings = c.parentId ? findNode(tree, c.parentId)?.children ?? [] : tree;
    const idx = siblings.findIndex((s) => s.id === c.id);
    const swap = idx + (dir === "up" ? -1 : 1);
    if (swap < 0 || swap >= siblings.length) return;
    const ordered = [...siblings];
    [ordered[idx], ordered[swap]] = [ordered[swap], ordered[idx]];
    await api.post(`/categories/reorder?${q}`, { orderedIds: ordered.map((s) => s.id) }, { auth: true });
    await loadTree();
  }

  function toggleKey(list: "attributeKeys" | "variantAxisKeys", val: string) {
    setForm((f) => ({ ...f, [list]: f[list].includes(val) ? f[list].filter((x) => x !== val) : [...f[list], val] }));
  }

  const variantOpts = masterKeys.filter((m) => m.usage.includes("variant"));
  const specOpts = masterKeys.filter((m) => m.usage.includes("spec"));
  const parentPath = editing?.category?.parentId
    ? findNode(tree, editing.category.parentId)?.path
    : editing?.parentId ? findNode(tree, editing.parentId)?.path : null;

  function Row({ c, depth }: { c: Category; depth: number }) {
    const isOpen = expanded.has(c.id) || !!search;
    const hasKids = c.children.length > 0;
    return (
      <div>
        <div className="group flex items-center gap-1.5 rounded-lg py-2 pr-2 hover:bg-accent-soft/60" style={{ paddingLeft: depth * 22 + 6 }}>
          <button onClick={() => setExpanded((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}
            className={cn("rounded p-0.5 text-muted transition-colors hover:text-ink", !hasKids && "invisible")}>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
          {hasKids ? (isOpen ? <FolderOpen className="h-4 w-4 shrink-0 text-accent" /> : <Folder className="h-4 w-4 shrink-0 text-accent" />) : <Tag className={cn("h-4 w-4 shrink-0", c.isActive ? "text-muted" : "text-muted/50")} />}
          <button onClick={() => startEdit(c)} className="flex min-w-0 items-center gap-2 text-left">
            <span className={cn("truncate text-sm font-medium", !c.isActive && "text-muted line-through")}>{c.name}</span>
          </button>
          <div className="ml-1 flex items-center gap-1.5">
            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-muted dark:bg-white/10">{c._count.products} product{c._count.products === 1 ? "" : "s"}</span>
            {hasKids && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] text-accent">{c.children.length} sub</span>}
            {!c.isActive && <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[11px] text-danger">Hidden</span>}
          </div>
          <div className="ml-auto flex items-center opacity-0 group-hover:opacity-100">
            {canUpdate && <button onClick={() => move(c, "up")} className="rounded p-1.5 text-muted hover:bg-card hover:text-ink" title="Move up"><ChevronUp className="h-4 w-4" /></button>}
            {canUpdate && <button onClick={() => move(c, "down")} className="rounded p-1.5 text-muted hover:bg-card hover:text-ink" title="Move down"><ChevronDown className="h-4 w-4" /></button>}
            {canCreate && <button onClick={() => startCreate(c.id)} className="rounded p-1.5 hover:bg-card" title="Add sub-category"><Plus className="h-4 w-4" /></button>}
            {canUpdate && <button onClick={() => startEdit(c)} className="rounded p-1.5 hover:bg-card" title="Edit"><Pencil className="h-4 w-4" /></button>}
            {canDelete && <button onClick={() => remove(c)} className="rounded p-1.5 text-danger hover:bg-card" title="Delete"><Trash2 className="h-4 w-4" /></button>}
          </div>
        </div>
        {isOpen && hasKids && (
          <div className="border-l border-line" style={{ marginLeft: depth * 22 + 19 }}>
            {c.children.map((ch) => <Row key={ch.id} c={ch} depth={depth + 1} />)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium">Categories</h1>
          <p className="mt-1 text-sm text-muted">Organise your catalog into a tree — e.g. Men → Shirts → Formal Shirts. {totalCount} in total.</p>
        </div>
        {canCreate && <button onClick={() => startCreate(null)} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90"><Plus className="h-4 w-4" /> New category</button>}
      </div>

      {tree.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search categories…" className="h-10 w-64 rounded-full border border-line bg-card pl-9 pr-4 text-sm outline-none focus:border-accent" />
          </div>
          <button onClick={() => setExpanded(new Set(allIds(tree)))} className="rounded-full border border-line px-3 py-2 text-xs text-muted hover:bg-accent-soft hover:text-ink">Expand all</button>
          <button onClick={() => setExpanded(new Set())} className="rounded-full border border-line px-3 py-2 text-xs text-muted hover:bg-accent-soft hover:text-ink">Collapse all</button>
        </div>
      )}

      {loading ? (
        <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>
      ) : tree.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-card py-16 text-center">
          <FolderTree className="h-10 w-10 text-muted/40" />
          <p className="mt-3 font-medium">No categories yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted">Create a top-level category like “Men” or “Sarees”, then add sub-categories inside it.</p>
          {canCreate && <button onClick={() => startCreate(null)} className="mt-4 flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90"><Plus className="h-4 w-4" /> Create first category</button>}
        </div>
      ) : (
        <div className="rounded-2xl border border-line bg-card p-2">
          {visible.length === 0 ? <p className="py-10 text-center text-sm text-muted">No categories match “{search}”.</p> : visible.map((c) => <Row key={c.id} c={c} depth={0} />)}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} aria-label="Close" />
          <form onSubmit={submit} className="relative flex h-full w-[80vw] max-w-[1100px] flex-col bg-card shadow-2xl">
            <div className="flex items-start justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="font-display text-lg">{editing.category ? "Edit category" : "New category"}</h2>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                  {parentPath ? <><CornerDownRight className="h-3.5 w-3.5" /> under <span className="font-mono">{parentPath}</span></> : "Top-level category"}
                </p>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-muted hover:bg-accent-soft"><X className="h-5 w-5" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg bg-accent-soft/50 p-3 text-xs leading-relaxed text-muted sm:col-span-2">
                  <Info className="mr-1 inline h-3.5 w-3.5 text-accent" /> Only a <b className="text-ink">name</b> is needed. Everything else is optional and can be changed anytime.
                </div>

                <div className="sm:col-span-2">
                  <Field label="Name" required placeholder="e.g. Formal Shirts" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                  <p className="mt-1 text-xs text-muted">Web address: <span className="font-mono text-ink">/{form.slug || slugify(form.name) || "…"}</span></p>
                </div>

                <Field label="Slug (optional)" placeholder="auto from name" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />

                <label className="block">
                  <Label>Parent category</Label>
                  <div className="relative">
                    <select value={form.parentId} onChange={(e) => setForm({ ...form, parentId: e.target.value })} className="h-11 w-full appearance-none rounded-lg border border-line bg-canvas px-3 pr-9 text-sm outline-none focus:border-accent">
                      <option value="">— Top level —</option>
                      {flat.filter((f) => f.c.id !== editing.category?.id).map((f) => <option key={f.c.id} value={f.c.id}>{"— ".repeat(f.depth)}{f.c.name}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  </div>
                </label>

                <div className="sm:col-span-2">
                  <Field label="Description (optional)" textarea placeholder="Short note about this category" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
                </div>

                <ImageUpload label="Image (optional)" value={form.imageUrl} folder="categories" onChange={(url) => setForm({ ...form, imageUrl: url })} hint="Recommended 800 × 800px (square) · JPG or PNG · under 5 MB" />

                <div className="flex h-fit items-center justify-between self-end rounded-lg border border-line px-3 py-2.5">
                  <div><p className="text-sm font-medium">Active</p><p className="text-xs text-muted">Show on the storefront</p></div>
                  <Toggle on={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
                </div>

              <div className="rounded-xl border border-line sm:col-span-2">
                <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="flex w-full items-center gap-2 px-3 py-3 text-left">
                  {showAdvanced ? <ChevronDown className="h-4 w-4 text-muted" /> : <ChevronRight className="h-4 w-4 text-muted" />}
                  <Layers className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium">Product form setup</span>
                  <span className="text-xs text-muted">optional</span>
                </button>
                {showAdvanced && (
                  <div className="space-y-4 border-t border-line px-3 py-4">
                    <p className="rounded-lg bg-accent-soft/40 p-2.5 text-xs leading-relaxed text-muted">
                      Set this once and every product added to this category will ask for the right fields automatically. Skip if unsure.
                    </p>
                    <div>
                      <Label>Variant axes</Label>
                      <p className="mb-2 text-xs leading-relaxed text-muted">What makes a <b className="text-ink">separate item</b> (own stock &amp; price). For clothing: <b className="text-ink">Size</b>, <b className="text-ink">Colour</b>.</p>
                      <Chips options={variantOpts} selected={form.variantAxisKeys} onToggle={(k) => toggleKey("variantAxisKeys", k)} />
                    </div>
                    <div>
                      <Label>Specification attributes</Label>
                      <p className="mb-2 text-xs leading-relaxed text-muted">Details that only <b className="text-ink">describe</b> the product (no separate stock). e.g. <b className="text-ink">Fabric</b>, <b className="text-ink">Occasion</b>.</p>
                      <Chips options={specOpts} selected={form.attributeKeys} onToggle={(k) => toggleKey("attributeKeys", k)} />
                    </div>
                  </div>
                )}
              </div>

                {error && <p className="text-sm text-danger sm:col-span-2">{error}</p>}
              </div>
            </div>

            <div className="flex items-center gap-3 border-t border-line px-6 py-4">
              <button type="submit" disabled={busy || !form.name.trim()} className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90 disabled:opacity-50">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} {editing.category ? "Save changes" : "Create category"}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="text-sm text-muted hover:text-ink">Cancel</button>
              {editing.category && canDelete && <button type="button" onClick={() => { const c = editing.category!; setEditing(null); remove(c); }} className="ml-auto rounded-lg p-2 text-danger hover:bg-danger/10" title="Delete"><Trash2 className="h-4 w-4" /></button>}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
