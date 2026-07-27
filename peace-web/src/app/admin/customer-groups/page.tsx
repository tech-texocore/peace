"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Pencil, X, Users, Star } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/form-fields";
import { PageHeader } from "@/components/admin/page-header";
import { SubNav, CUSTOMER_TABS } from "@/components/admin/sub-nav";
import { EmptyState } from "@/components/admin/empty-state";
import { cn } from "@/lib/utils/cn";

interface Group { id: string; name: string; slug: string; description?: string | null; isDefault: boolean; _count: { users: number } }
const emptyForm = { name: "", slug: "", description: "", isDefault: false };

export default function CustomerGroupsPage() {
  const { storeId, hasPermission } = useAdminAuth();
  const confirm = useConfirm();
  const [rows, setRows] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Group | "new" | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = hasPermission("customergroups.create");
  const canUpdate = hasPermission("customergroups.update");
  const canDelete = hasPermission("customergroups.delete");
  const q = storeId ? `storeId=${storeId}` : "";

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const res = await api.get<{ items: Group[] }>(`/customer-groups?${q}&limit=100`, { auth: true });
    setRows(res.items); setLoading(false);
  }, [storeId, q]);

  useEffect(() => { load(); }, [load]);

  function startCreate() { setEditing("new"); setForm(emptyForm); setError(null); }
  function startEdit(g: Group) { setEditing(g); setForm({ name: g.name, slug: g.slug, description: g.description ?? "", isDefault: g.isDefault }); setError(null); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const payload = { name: form.name, slug: form.slug || undefined, description: form.description, isDefault: form.isDefault };
    try {
      if (editing && editing !== "new") await api.patch(`/customer-groups/${editing.id}?${q}`, payload, { auth: true });
      else await api.post(`/customer-groups?${q}`, payload, { auth: true });
      setEditing(null); await load();
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  async function remove(g: Group) {
    const ok = await confirm({ title: `Delete “${g.name}”?`, message: g._count.users > 0 ? `${g._count.users} customer(s) will be moved to no group.` : "The group will be removed.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await api.delete(`/customer-groups/${g.id}?${q}`, { auth: true });
      setRows((r) => r.filter((x) => x.id !== g.id));
    } catch (err) { await confirm({ title: "Cannot delete", message: (err as Error).message, confirmLabel: "OK" }); }
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Customer Groups"
        description="Segments like Wholesale or VIP that get their own pricing."
        action={canCreate && <button onClick={startCreate} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90"><Plus className="h-4 w-4" /> New group</button>}
      />
      <SubNav tabs={CUSTOMER_TABS} />

      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Group</th>
              <th className="px-5 py-3 font-semibold">Customers</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={3} className="p-0">
                <EmptyState icon={Users} title="No groups yet" description="Create tiers like Retail, Wholesale, or VIP to give segments their own pricing." action={canCreate && <button onClick={startCreate} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90"><Plus className="h-4 w-4" /> New group</button>} />
              </td></tr>
            ) : rows.map((g) => (
              <tr key={g.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3">
                  <span className="flex items-center gap-2 font-medium">
                    <Users className="h-4 w-4 text-muted" />{g.name}
                    {g.isDefault && <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent"><Star className="h-3 w-3" /> Default</span>}
                  </span>
                  {g.description && <span className="ml-6 block text-xs text-muted">{g.description}</span>}
                </td>
                <td className="px-5 py-3 text-muted">{g._count.users}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    {canUpdate && <button onClick={() => startEdit(g)} className="rounded-lg p-1.5 hover:bg-accent-soft" title="Edit"><Pencil className="h-4 w-4" /></button>}
                    {canDelete && <button onClick={() => remove(g)} className="rounded-lg p-1.5 text-danger hover:bg-danger/10" title="Delete"><Trash2 className="h-4 w-4" /></button>}
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
              <h2 className="font-display text-lg">{editing === "new" ? "New group" : "Edit group"}</h2>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg p-1.5 text-muted hover:bg-accent-soft"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
              <Field label="Name" required placeholder="e.g. Wholesale" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
              <Field label="Slug (optional)" placeholder="auto from name" value={form.slug} onChange={(v) => setForm({ ...form, slug: v })} />
              <Field label="Description (optional)" textarea placeholder="Who's in this group" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
                Default group (new customers join this)
              </label>
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
