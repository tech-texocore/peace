"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Check } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { cn } from "@/lib/utils/cn";

type Action = "create" | "read" | "update" | "delete" | "publish";
interface PermModule {
  key: string;
  label: string;
  route: string;
  actions: Action[];
}
interface Role {
  id: string;
  key: string;
  name: string;
  permissions: string[];
  isSystem: boolean;
}

const CRUD: Action[] = ["create", "read", "update", "delete"];
const EXTRA: Action[] = ["publish"];
const ACTION_LABEL: Record<Action, string> = {
  create: "Add",
  read: "View",
  update: "Edit",
  delete: "Delete",
  publish: "Publish to storefront",
};

export default function RolesPage() {
  const { storeId } = useAdminAuth();
  const [modules, setModules] = useState<PermModule[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const selected = useMemo(() => roles.find((r) => r.id === selectedId) ?? null, [roles, selectedId]);

  async function load() {
    setLoading(true);
    const [mods, rs] = await Promise.all([
      api.get<PermModule[]>("/access/permissions", { auth: true }),
      api.get<Role[]>("/access/roles", { auth: true }),
    ]);
    setModules(mods);
    setRoles(rs);
    if (rs.length) selectRole(rs.find((r) => r.id === selectedId) ?? rs[0]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectRole(role: Role) {
    setSelectedId(role.id);
    setDraft(new Set(role.permissions));
    setSaved(false);
  }

  function key(mod: string, action: Action) {
    return `${mod}.${action}`;
  }

  function toggle(k: string) {
    setDraft((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });
    setSaved(false);
  }

  function toggleColumn(action: Action) {
    const keys = modules.filter((m) => m.actions.includes(action)).map((m) => key(m.key, action));
    const allOn = keys.every((k) => draft.has(k));
    setDraft((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return next;
    });
    setSaved(false);
  }

  function toggleRow(mod: PermModule) {
    const keys = mod.actions.map((a) => key(mod.key, a));
    const allOn = keys.every((k) => draft.has(k));
    setDraft((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return next;
    });
    setSaved(false);
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    const updated = await api.patch<Role>(`/access/roles/${selected.id}`, { permissions: [...draft] }, { auth: true });
    setRoles((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
    setSaving(false);
    setSaved(true);
  }

  async function createRole() {
    if (!newName.trim()) return;
    const roleKey = newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const role = await api.post<Role>("/access/roles", { name: newName.trim(), key: roleKey, storeId, permissions: ["config.read"] }, { auth: true });
    setRoles((rs) => [...rs, role]);
    setNewName("");
    setCreating(false);
    selectRole(role);
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;
  }

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-medium">Roles & Permissions</h1>
        <p className="mt-1 text-sm text-muted">Control exactly what each role can see and do. Super Admin always has full access.</p>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        {roles.map((r) => (
          <button
            key={r.id}
            onClick={() => selectRole(r)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
              selectedId === r.id ? "border-accent bg-accent text-accent-foreground" : "border-line bg-card text-muted hover:text-ink",
            )}
          >
            {r.name}
            {r.isSystem && <span className="ml-2 text-[10px] uppercase opacity-70">system</span>}
          </button>
        ))}
        {creating ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createRole()}
              placeholder="Role name"
              className="h-9 rounded-full border border-line bg-card px-4 text-sm outline-none focus:border-accent"
            />
            <button onClick={createRole} className="rounded-full bg-ink px-4 py-2 text-xs font-semibold uppercase tracking-wide text-canvas">Add</button>
            <button onClick={() => setCreating(false)} className="text-sm text-muted">Cancel</button>
          </div>
        ) : (
          <button onClick={() => setCreating(true)} className="flex items-center gap-1 rounded-full border border-dashed border-line px-4 py-2 text-sm text-muted hover:text-ink">
            <Plus className="h-4 w-4" /> New role
          </button>
        )}
      </div>

      {selected && (
        <>
          <div className="overflow-x-auto rounded-2xl border border-line bg-card">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 text-left font-semibold">Module</th>
                  {CRUD.map((a) => (
                    <th key={a} className="px-3 py-3 text-center font-semibold">
                      <div className="flex flex-col items-center gap-1.5">
                        <span>{ACTION_LABEL[a]}</span>
                        <input
                          type="checkbox"
                          aria-label={`toggle all ${ACTION_LABEL[a]}`}
                          onChange={() => toggleColumn(a)}
                          checked={modules.filter((m) => m.actions.includes(a)).every((m) => draft.has(key(m.key, a)))}
                          className="h-3.5 w-3.5 accent-[var(--accent)]"
                        />
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center font-semibold">Extra</th>
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <tr key={m.key} className="border-b border-line last:border-0 hover:bg-accent-soft/40">
                    <td className="px-5 py-3">
                      <button onClick={() => toggleRow(m)} className="text-left">
                        <span className="block font-medium">{m.label}</span>
                      </button>
                    </td>
                    {CRUD.map((a) => {
                      const supported = m.actions.includes(a);
                      const k = key(m.key, a);
                      const on = draft.has(k);
                      return (
                        <td key={a} className="px-3 py-3 text-center">
                          {supported ? (
                            <button
                              onClick={() => toggle(k)}
                              aria-label={`${m.label} ${a}`}
                              className={cn(
                                "inline-flex h-6 w-6 items-center justify-center rounded-md border transition-colors",
                                on ? "border-accent bg-accent text-accent-foreground" : "border-line hover:border-accent/60",
                              )}
                            >
                              {on && <Check className="h-4 w-4" />}
                            </button>
                          ) : (
                            <span className="text-line">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-3">
                        {EXTRA.filter((a) => m.actions.includes(a)).map((a) => {
                          const k = key(m.key, a);
                          const on = draft.has(k);
                          return (
                            <label key={a} className="inline-flex cursor-pointer items-center gap-1.5 text-xs">
                              <button
                                onClick={() => toggle(k)}
                                className={cn(
                                  "inline-flex h-5 w-5 items-center justify-center rounded border transition-colors",
                                  on ? "border-accent bg-accent text-accent-foreground" : "border-line",
                                )}
                              >
                                {on && <Check className="h-3.5 w-3.5" />}
                              </button>
                              {ACTION_LABEL[a]}
                            </label>
                          );
                        })}
                        {!EXTRA.some((a) => m.actions.includes(a)) && <span className="text-line">—</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-xs text-muted">Tip: click a row or a column heading to turn everything in it on or off.</p>

          <div className="sticky bottom-4 mt-6 flex items-center justify-end gap-3">
            {saved && <span className="text-sm text-accent">Saved</span>}
            <span className="text-sm text-muted">{draft.size} permissions</span>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save {selected.name}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
