"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Pencil, Search, X, Tag } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/form-fields";
import { ImageUpload } from "@/components/ui/image-upload";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";
import { cn } from "@/lib/utils/cn";

interface Brand {
  id: string; name: string; slug: string; logoUrl?: string | null; description?: string | null;
  isActive: boolean; _count: { products: number };
}
const emptyForm = { name: "", slug: "", logoUrl: "", description: "", isActive: true };
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", on ? "bg-accent" : "bg-black/15 dark:bg-white/20")}>
      <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform", on ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

export default function BrandsPage() {
  const { storeId, hasPermission } = useAdminAuth();
  const confirm = useConfirm();
  const [rows, setRows] = useState<Brand[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Brand | "new" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = hasPermission("brands.create");
  const canUpdate = hasPermission("brands.update");
  const canDelete = hasPermission("brands.delete");
  const q = storeId ? `storeId=${storeId}` : "";

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const params = new URLSearchParams(q);
    if (search) params.set("search", search);
    const res = await api.get<{ items: Brand[]; total: number }>(`/brands?${params}&limit=100`, { auth: true });
    setRows(res.items); setTotal(res.total); setLoading(false);
  }, [storeId, q, search]);

  useEffect(() => { load(); }, [load]);

  function startCreate() { setEditing("new"); setForm(emptyForm); setError(null); }
  function startEdit(b: Brand) {
    setEditing(b);
    setForm({ name: b.name, slug: b.slug, logoUrl: b.logoUrl ?? "", description: b.description ?? "", isActive: b.isActive });
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const payload = { name: form.name, slug: form.slug || undefined, logoUrl: form.logoUrl, description: form.description, isActive: form.isActive };
    try {
      if (editing && editing !== "new") await api.patch(`/brands/${editing.id}?${q}`, payload, { auth: true });
      else await api.post(`/brands?${q}`, payload, { auth: true });
      setEditing(null); await load();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  async function remove(b: Brand) {
    const ok = await confirm({ title: `Delete “${b.name}”?`, message: "The brand will be removed.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try { await api.delete(`/brands/${b.id}?${q}`, { auth: true }); setRows((r) => r.filter((x) => x.id !== b.id)); }
    catch (err) { await confirm({ title: "Cannot delete", message: (err as Error).message, confirmLabel: "OK" }); }
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Brands"
        description="The brands you stock. Add a logo and details; products link to a brand."
        action={canCreate && <button onClick={startCreate} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90"><Plus className="h-4 w-4" /> New brand</button>}
      />

      <div className="mb-3 relative w-64">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search brands…" className="h-10 w-full rounded-full border border-line bg-card pl-9 pr-4 text-sm outline-none focus:border-accent" />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Brand</th>
              <th className="px-5 py-3 font-semibold">Products</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={4} className="p-0">
                <EmptyState icon={Tag} title={search ? "No matching brands" : "No brands yet"} description={search ? "Try a different search term." : "Add the brands you stock so products can be linked to them."} action={!search && canCreate && <button onClick={startCreate} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90"><Plus className="h-4 w-4" /> New brand</button>} />
              </td></tr>
            ) : rows.map((b) => (
              <tr key={b.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">
                  <span className="flex items-center gap-3 font-medium">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-canvas">
                      {b.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.logoUrl} alt="" className="h-full w-full object-contain" />
                      ) : <Tag className="h-4 w-4 text-muted" />}
                    </span>
                    {b.name}
                  </span>
                </td>
                <td className="px-5 py-3 text-muted">{b._count.products}</td>
                <td className="px-5 py-3"><span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", b.isActive ? "bg-accent-soft text-accent" : "bg-danger/10 text-danger")}>{b.isActive ? "Active" : "Hidden"}</span></td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {canUpdate && <button onClick={() => startEdit(b)} className="rounded-lg p-1.5 hover:bg-accent-soft" title="Edit"><Pencil className="h-4 w-4" /></button>}
                    {canDelete && <button onClick={() => remove(b)} className="rounded-lg p-1.5 text-danger hover:bg-danger/10" title="Delete"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <button className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} aria-label="Close" />
          <form onSubmit={submit} className="relative flex h-full w-[80vw] max-w-md flex-col bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="font-display text-lg">{editing === "new" ? "New brand" : "Edit brand"}</h2>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-muted hover:bg-accent-soft"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <div>
                <Field label="Name" required placeholder="e.g. Anaya" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                <p className="mt-1 text-xs text-muted">Web address: <span className="font-mono text-ink">/brands/{form.slug || slugify(form.name) || "…"}</span></p>
              </div>
              <Field label="Slug (optional)" placeholder="auto from name" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
              <ImageUpload label="Logo" value={form.logoUrl} folder="brands" onChange={(url) => setForm({ ...form, logoUrl: url })} hint="Recommended 400 × 400px (square) · transparent PNG · under 5 MB" />
              <Field label="Description (optional)" textarea placeholder="About the brand" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
              <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
                <div><p className="text-sm font-medium">Active</p><p className="text-xs text-muted">Show on the storefront</p></div>
                <Toggle on={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} />
              </div>
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>
            <div className="flex items-center gap-3 border-t border-line px-5 py-4">
              <button type="submit" disabled={busy || !form.name.trim()} className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90 disabled:opacity-50">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />} {editing === "new" ? "Create" : "Save"}
              </button>
              <button type="button" onClick={() => setEditing(null)} className="text-sm text-muted hover:text-ink">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
