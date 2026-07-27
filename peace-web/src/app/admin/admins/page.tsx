"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, UserCog, Pencil } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { PageHeader } from "@/components/admin/page-header";
import { EmptyState } from "@/components/admin/empty-state";

interface Store { id: string; name: string; slug: string }
interface AccessRole { id: string; name: string; storeId: string | null }
interface AdminRow {
  id: string;
  name: string | null;
  email: string;
  role: string;
  isActive: boolean;
  storeId: string | null;
  store?: { id: string; name: string } | null;
  roleRef?: { id: string; name: string } | null;
}

const emptyForm = { name: "", email: "", password: "", storeId: "", roleId: "" };

export default function AdminsPage() {
  const confirm = useConfirm();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadAdmins() {
    setAdmins(await api.get<AdminRow[]>("/admin-users", { auth: true }));
  }

  async function loadRoles(storeId: string) {
    if (!storeId) return setRoles([]);
    setRoles(await api.get<AccessRole[]>(`/access/roles?storeId=${storeId}`, { auth: true }));
  }

  useEffect(() => {
    (async () => {
      const [a, s] = await Promise.all([
        api.get<AdminRow[]>("/admin-users", { auth: true }),
        api.get<Store[]>("/stores", { auth: true }).catch(() => [] as Store[]),
      ]);
      setAdmins(a);
      setStores(s);
      setLoading(false);
    })();
  }, []);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setRoles([]);
    setError(null);
    setShowForm(true);
  }

  async function startEdit(a: AdminRow) {
    setEditingId(a.id);
    setForm({ name: a.name ?? "", email: a.email, password: "", storeId: a.storeId ?? "", roleId: a.roleRef?.id ?? "" });
    setError(null);
    setShowForm(true);
    if (a.storeId) await loadRoles(a.storeId);
  }

  async function onStoreChange(storeId: string) {
    setForm((f) => ({ ...f, storeId, roleId: "" }));
    await loadRoles(storeId);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (editingId) {
        await api.patch(`/admin-users/${editingId}`, { name: form.name, storeId: form.storeId, roleId: form.roleId }, { auth: true });
      } else {
        await api.post("/admin-users", { ...form, role: "ADMIN" }, { auth: true });
      }
      setShowForm(false);
      setForm(emptyForm);
      setRoles([]);
      await loadAdmins();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(a: AdminRow) {
    if (a.isActive) {
      const ok = await confirm({
        title: "Disable this admin?",
        message: `${a.email} will no longer be able to sign in.`,
        confirmLabel: "Disable",
        danger: true,
      });
      if (!ok) return;
    }
    const updated = await api.patch<AdminRow>(`/admin-users/${a.id}`, { isActive: !a.isActive }, { auth: true });
    setAdmins((rows) => rows.map((r) => (r.id === a.id ? { ...r, isActive: updated.isActive } : r)));
  }

  async function remove(a: AdminRow) {
    const ok = await confirm({
      title: "Remove this admin?",
      message: `${a.email} will be deleted and their login disabled.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    await api.delete(`/admin-users/${a.id}`, { auth: true });
    setAdmins((rows) => rows.filter((r) => r.id !== a.id));
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Admins"
        description="People who can sign in and manage your store. Assign each a role that limits what they can do."
        action={!showForm && (
          <button onClick={startCreate} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> New admin
          </button>
        )}
      />

      {showForm && (
        <form onSubmit={submit} className="mb-6 rounded-2xl border border-line bg-card p-5">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted">
            {editingId ? "Edit admin" : "New admin account"}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <input required placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" />
            <input required type="email" placeholder="Email" value={form.email} disabled={!!editingId} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11 rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent disabled:opacity-60" />
            {!editingId && (
              <div>
                <input required type="password" placeholder="Temporary password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="h-11 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" />
                <p className="mt-1 text-xs text-muted">They'll use this to sign in the first time — ask them to change it after.</p>
              </div>
            )}
            <select required value={form.storeId} onChange={(e) => onStoreChange(e.target.value)} className="h-11 rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent">
              <option value="">Select store…</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select required value={form.roleId} onChange={(e) => setForm({ ...form, roleId: e.target.value })} disabled={!form.storeId} className="h-11 rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent disabled:opacity-50">
              <option value="">Select role…</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          <div className="mt-4 flex items-center gap-3">
            <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-full bg-ink px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-canvas hover:opacity-90 disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {editingId ? "Save changes" : "Create admin"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setError(null); }} className="text-sm text-muted">Cancel</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Name</th>
              <th className="px-5 py-3 font-semibold">Email</th>
              <th className="px-5 py-3 font-semibold">Role</th>
              <th className="px-5 py-3 font-semibold">Store</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 ? (
              <tr><td colSpan={6} className="p-0">
                <EmptyState icon={UserCog} title="No admins yet" description="Add a team member so they can sign in and help manage your store. Each one gets a role that limits what they can do." action={!showForm && <button onClick={startCreate} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90"><Plus className="h-4 w-4" /> New admin</button>} />
              </td></tr>
            ) : admins.map((a) => (
              <tr key={a.id} className="border-b border-line last:border-0">
                <td className="px-5 py-3 font-medium">
                  <span className="flex items-center gap-2"><UserCog className="h-4 w-4 text-muted" />{a.name ?? "—"}</span>
                </td>
                <td className="px-5 py-3 text-muted">{a.email}</td>
                <td className="px-5 py-3">{a.role === "SUPER_ADMIN" ? "Super Admin" : a.roleRef?.name ?? "Admin"}</td>
                <td className="px-5 py-3 text-muted">{a.store?.name ?? "Platform"}</td>
                <td className="px-5 py-3">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", a.isActive ? "bg-accent-soft text-accent" : "bg-danger/10 text-danger")}>
                    {a.isActive ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="px-5 py-3">
                  {a.role !== "SUPER_ADMIN" && (
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => startEdit(a)} className="rounded-lg p-1.5 hover:bg-accent-soft" title="Edit"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => toggleActive(a)} className="rounded-lg px-2.5 py-1 text-xs font-medium hover:bg-accent-soft">{a.isActive ? "Disable" : "Enable"}</button>
                      <button onClick={() => remove(a)} className="rounded-lg p-1.5 text-danger hover:bg-danger/10" title="Delete"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
