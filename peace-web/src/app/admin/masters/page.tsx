"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Pencil, Lock, Check, X, List, Settings2 } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils/cn";

type FieldType = "text" | "number" | "color" | "select";
interface MasterField { key: string; label: string; type: FieldType; unit?: string; options?: string[] }
interface MasterListRow { id: string; key: string; label: string; isSystem: boolean; usage?: string[]; _count: { items: number } }
interface MasterItem { id: string; value: string; label: string; metadata?: Record<string, unknown> | null; position: number; isActive: boolean }
interface MasterListDetail extends MasterListRow { fields?: MasterField[] | null; items: MasterItem[] }

const FIELD_TYPES: FieldType[] = ["text", "number", "color", "select"];
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export default function MastersPage() {
  const { storeId, hasPermission } = useAdminAuth();
  const confirm = useConfirm();
  const [lists, setLists] = useState<MasterListRow[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<MasterListDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [newList, setNewList] = useState<{ label: string; key: string } | null>(null);
  const [itemForm, setItemForm] = useState<{ value: string; label: string; metadata: Record<string, string> }>({ value: "", label: "", metadata: {} });
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [fieldsDraft, setFieldsDraft] = useState<MasterField[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = hasPermission("masters.create");
  const canUpdate = hasPermission("masters.update");
  const canDelete = hasPermission("masters.delete");
  const q = storeId ? `storeId=${storeId}` : "";
  const fields = detail?.fields ?? [];

  const loadLists = useCallback(async () => {
    if (!storeId) return;
    const data = await api.get<MasterListRow[]>(`/masters?${q}`, { auth: true });
    setLists(data);
    setActiveKey((k) => k ?? data[0]?.key ?? null);
    setLoading(false);
  }, [storeId, q]);

  const loadDetail = useCallback(async (key: string) => {
    setDetail(await api.get<MasterListDetail>(`/masters/${key}?${q}`, { auth: true }));
  }, [q]);

  useEffect(() => { loadLists(); }, [loadLists]);
  useEffect(() => { if (activeKey) loadDetail(activeKey); }, [activeKey, loadDetail]);

  function resetItemForm() { setItemForm({ value: "", label: "", metadata: {} }); setEditingItem(null); setError(null); }

  function selectList(key: string) { setActiveKey(key); resetItemForm(); setFieldsDraft(null); }

  function startEditItem(it: MasterItem) {
    setEditingItem(it.id);
    const metadata: Record<string, string> = {};
    fields.forEach((f) => { metadata[f.key] = it.metadata?.[f.key] != null ? String(it.metadata[f.key]) : ""; });
    setItemForm({ value: it.value, label: it.label, metadata });
    setError(null);
  }

  async function submitItem(e: React.FormEvent) {
    e.preventDefault();
    if (!detail) return;
    setBusy(true); setError(null);
    const metadata: Record<string, unknown> = {};
    fields.forEach((f) => {
      const raw = itemForm.metadata[f.key];
      if (raw === undefined || raw === "") return;
      metadata[f.key] = f.type === "number" ? Number(raw) : raw;
    });
    const payload = { value: itemForm.value, label: itemForm.label || itemForm.value, ...(fields.length ? { metadata } : {}) };
    try {
      if (editingItem) await api.patch(`/masters/items/${editingItem}?${q}`, payload, { auth: true });
      else await api.post(`/masters/${detail.id}/items?${q}`, payload, { auth: true });
      resetItemForm();
      await Promise.all([loadDetail(detail.key), loadLists()]);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  async function toggleItem(it: MasterItem) {
    if (!detail) return;
    await api.patch(`/masters/items/${it.id}?${q}`, { isActive: !it.isActive }, { auth: true });
    loadDetail(detail.key);
  }

  async function removeItem(it: MasterItem) {
    if (!detail) return;
    const ok = await confirm({ title: "Delete this option?", message: `“${it.label}” will be removed from ${detail.label}.`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await api.delete(`/masters/items/${it.id}?${q}`, { auth: true });
      await Promise.all([loadDetail(detail.key), loadLists()]);
    } catch (err) { await confirm({ title: "Can’t delete this option", message: (err as Error).message, confirmLabel: "OK" }); }
  }

  async function createList(e: React.FormEvent) {
    e.preventDefault();
    if (!newList) return;
    setBusy(true); setError(null);
    try {
      await api.post(`/masters?${q}`, { key: newList.key, label: newList.label }, { auth: true });
      setNewList(null);
      await loadLists();
      selectList(newList.key);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  async function removeList() {
    if (!detail) return;
    const ok = await confirm({ title: "Delete this list?", message: `“${detail.label}” and all its options will be removed.`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await api.delete(`/masters/${detail.id}?${q}`, { auth: true });
      setActiveKey(null); setDetail(null);
      await loadLists();
    } catch (err) { await confirm({ title: "Can’t delete this list", message: (err as Error).message, confirmLabel: "OK" }); }
  }

  async function toggleUsage(u: "variant" | "spec") {
    if (!detail) return;
    const cur = detail.usage ?? [];
    const next = cur.includes(u) ? cur.filter((x) => x !== u) : [...cur, u];
    await api.patch(`/masters/${detail.id}?${q}`, { usage: next }, { auth: true });
    await Promise.all([loadDetail(detail.key), loadLists()]);
  }

  async function saveFields() {
    if (!detail || !fieldsDraft) return;
    setBusy(true); setError(null);
    const cleaned = fieldsDraft.filter((f) => f.label.trim()).map((f) => ({ ...f, key: f.key || slug(f.label) }));
    try {
      await api.patch(`/masters/${detail.id}?${q}`, { fields: cleaned }, { auth: true });
      setFieldsDraft(null);
      await loadDetail(detail.key);
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }

  function renderFieldValue(it: MasterItem, f: MasterField) {
    const v = it.metadata?.[f.key];
    if (v == null || v === "") return null;
    if (f.type === "color") return <span key={f.key} className="inline-flex items-center gap-1"><span className="h-4 w-4 rounded-full border border-black/10" style={{ background: String(v) }} />{String(v)}</span>;
    return <span key={f.key} className="text-muted">{f.label}: <span className="text-ink">{String(v)}{f.unit ? ` ${f.unit}` : ""}</span></span>;
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-medium">Option lists</h1>
        <p className="mt-1 text-sm text-muted">The dropdown choices you reuse across products — sizes, colours, fabrics and more. Add or edit them once here, and they appear everywhere.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-2xl border border-line bg-card p-2">
          <ul className="space-y-0.5">
            {lists.map((l) => (
              <li key={l.id}>
                <button onClick={() => selectList(l.key)}
                  className={cn("flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors", activeKey === l.key ? "bg-accent text-accent-foreground" : "hover:bg-accent-soft")}>
                  <span className="flex items-center gap-2 font-medium"><List className="h-4 w-4 opacity-70" />{l.label}{l.isSystem && <Lock className="h-3 w-3 opacity-50" />}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs", activeKey === l.key ? "bg-white/20" : "bg-accent-soft text-accent")}>{l._count.items}</span>
                </button>
              </li>
            ))}
          </ul>
          {canCreate && (
            <div className="mt-2 border-t border-line pt-2">
              {newList ? (
                <form onSubmit={createList} className="space-y-2 p-1">
                  <input autoFocus required placeholder="List name (e.g. Sleeve Type)" value={newList.label}
                    onChange={(e) => setNewList({ label: e.target.value, key: slug(e.target.value) })}
                    className="h-9 w-full rounded-lg border border-line bg-canvas px-2.5 text-sm outline-none focus:border-accent" />
                  <div className="flex gap-2">
                    <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-ink py-1.5 text-xs font-semibold text-canvas disabled:opacity-50">Add</button>
                    <button type="button" onClick={() => { setNewList(null); setError(null); }} className="rounded-lg px-3 py-1.5 text-xs text-muted">Cancel</button>
                  </div>
                  {error && <p className="text-xs text-danger">{error}</p>}
                </form>
              ) : (
                <button onClick={() => setNewList({ label: "", key: "" })} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-accent-soft hover:text-ink">
                  <Plus className="h-4 w-4" /> New master list
                </button>
              )}
            </div>
          )}
        </aside>

        <section className="rounded-2xl border border-line bg-card p-5">
          {!detail ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted">Select a list to manage its items.</div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg">{detail.label}</h2>
                  <p className="text-xs text-muted">{detail.items.length} option{detail.items.length === 1 ? "" : "s"}{detail.isSystem && " · built-in"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {canUpdate && (
                    <button onClick={() => setFieldsDraft(fieldsDraft ? null : (fields.length ? [...fields] : []))} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs", fieldsDraft ? "border-accent text-accent" : "border-line hover:bg-accent-soft")}>
                      <Settings2 className="h-3.5 w-3.5" /> Configure fields
                    </button>
                  )}
                  {canDelete && !detail.isSystem && (
                    <button onClick={removeList} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs text-danger hover:bg-danger/10"><Trash2 className="h-3.5 w-3.5" /> Delete list</button>
                  )}
                </div>
              </div>

              {canUpdate && (
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-canvas px-3 py-2.5">
                  <span className="text-xs text-muted">Usable on products as:</span>
                  {(["variant", "spec"] as const).map((u) => {
                    const on = (detail.usage ?? []).includes(u);
                    return (
                      <button key={u} type="button" onClick={() => toggleUsage(u)}
                        className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", on ? "border-accent bg-accent text-accent-foreground" : "border-line hover:bg-accent-soft")}>
                        {u === "variant" ? "Variant axis" : "Specification"}
                      </button>
                    );
                  })}
                  <span className="text-xs text-muted/70">— controls where it appears in category & product forms</span>
                </div>
              )}

              {fieldsDraft && (
                <div className="mb-4 rounded-xl border border-accent/40 bg-accent-soft/30 p-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">Fields — attributes every item in this list can hold</p>
                  <div className="space-y-2">
                    {fieldsDraft.map((f, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2">
                        <input placeholder="Field name (e.g. Chest)" value={f.label} onChange={(e) => setFieldsDraft(fieldsDraft.map((x, j) => j === i ? { ...x, label: e.target.value, key: x.key || slug(e.target.value) } : x))} className="h-9 flex-1 min-w-[140px] rounded-lg border border-line bg-card px-2.5 text-sm outline-none focus:border-accent" />
                        <select value={f.type} onChange={(e) => setFieldsDraft(fieldsDraft.map((x, j) => j === i ? { ...x, type: e.target.value as FieldType } : x))} className="h-9 rounded-lg border border-line bg-card px-2 text-sm outline-none focus:border-accent">
                          {FIELD_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        {f.type === "number" && <input placeholder="unit (in)" value={f.unit ?? ""} onChange={(e) => setFieldsDraft(fieldsDraft.map((x, j) => j === i ? { ...x, unit: e.target.value } : x))} className="h-9 w-20 rounded-lg border border-line bg-card px-2.5 text-sm outline-none focus:border-accent" />}
                        {f.type === "select" && <input placeholder="options, comma separated" value={(f.options ?? []).join(", ")} onChange={(e) => setFieldsDraft(fieldsDraft.map((x, j) => j === i ? { ...x, options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) } : x))} className="h-9 flex-1 min-w-[140px] rounded-lg border border-line bg-card px-2.5 text-sm outline-none focus:border-accent" />}
                        <button type="button" onClick={() => setFieldsDraft(fieldsDraft.filter((_, j) => j !== i))} className="rounded-lg p-1.5 text-danger hover:bg-danger/10"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button type="button" onClick={() => setFieldsDraft([...fieldsDraft, { key: "", label: "", type: "text" }])} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-accent-soft"><Plus className="h-3.5 w-3.5" /> Add field</button>
                    <button type="button" onClick={saveFields} disabled={busy} className="rounded-lg bg-accent px-4 py-1.5 text-xs font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50">Save fields</button>
                    <button type="button" onClick={() => setFieldsDraft(null)} className="px-2 py-1.5 text-xs text-muted">Cancel</button>
                  </div>
                </div>
              )}

              {(canCreate || canUpdate) && (
                <form onSubmit={submitItem} className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-line bg-canvas p-3">
                  <label className="flex-1 min-w-[120px]">
                    <span className="mb-1 block text-xs font-medium text-muted">Option name</span>
                    <input required value={itemForm.value} onChange={(e) => setItemForm({ ...itemForm, value: e.target.value })} placeholder="e.g. Round Neck" className="h-9 w-full rounded-lg border border-line bg-card px-2.5 text-sm outline-none focus:border-accent" />
                  </label>
                  <label className="flex-1 min-w-[120px]">
                    <span className="mb-1 block text-xs font-medium text-muted">Shown to customers <span className="text-muted/60">(optional)</span></span>
                    <input value={itemForm.label} onChange={(e) => setItemForm({ ...itemForm, label: e.target.value })} placeholder="Leave blank to use the name" className="h-9 w-full rounded-lg border border-line bg-card px-2.5 text-sm outline-none focus:border-accent" />
                  </label>
                  {fields.map((f) => (
                    <label key={f.key} className={cn(f.type === "color" ? "" : "w-28")}>
                      <span className="mb-1 block text-xs font-medium text-muted">{f.label}{f.unit ? ` (${f.unit})` : ""}</span>
                      {f.type === "color" ? (
                        <input type="color" value={itemForm.metadata[f.key] || "#000000"} onChange={(e) => setItemForm({ ...itemForm, metadata: { ...itemForm.metadata, [f.key]: e.target.value } })} className="h-9 w-12 cursor-pointer rounded-lg border border-line bg-card p-1" />
                      ) : f.type === "select" ? (
                        <select value={itemForm.metadata[f.key] ?? ""} onChange={(e) => setItemForm({ ...itemForm, metadata: { ...itemForm.metadata, [f.key]: e.target.value } })} className="h-9 w-full rounded-lg border border-line bg-card px-2 text-sm outline-none focus:border-accent">
                          <option value="">—</option>
                          {(f.options ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input type={f.type === "number" ? "number" : "text"} value={itemForm.metadata[f.key] ?? ""} onChange={(e) => setItemForm({ ...itemForm, metadata: { ...itemForm.metadata, [f.key]: e.target.value } })} className="h-9 w-full rounded-lg border border-line bg-card px-2.5 text-sm outline-none focus:border-accent" />
                      )}
                    </label>
                  ))}
                  <button type="submit" disabled={busy} className="flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-xs font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50">
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : editingItem ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}{editingItem ? "Save" : "Add"}
                  </button>
                  {editingItem && <button type="button" onClick={resetItemForm} className="h-9 px-2 text-xs text-muted">Cancel</button>}
                  {error && <p className="w-full text-xs text-danger">{error}</p>}
                </form>
              )}

              <div className="divide-y divide-line">
                {detail.items.map((it) => (
                  <div key={it.id} className={cn("flex items-center gap-3 py-2.5", !it.isActive && "opacity-50")}>
                    {fields.some((f) => f.type === "color") && <span className="h-6 w-6 shrink-0 rounded-full border border-black/10" style={{ background: String(it.metadata?.[fields.find((f) => f.type === "color")!.key] ?? "#ccc") }} />}
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium">{it.label}</span>
                      {it.label !== it.value && <span className="ml-2 font-mono text-xs text-muted">{it.value}</span>}
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">{fields.filter((f) => f.type !== "color").map((f) => renderFieldValue(it, f))}</div>
                    </div>
                    {!it.isActive && <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-muted dark:bg-white/10">Hidden</span>}
                    <div className="flex items-center gap-1">
                      {canUpdate && <button onClick={() => toggleItem(it)} className="rounded-lg p-1.5 hover:bg-accent-soft" title={it.isActive ? "Hide" : "Show"}>{it.isActive ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}</button>}
                      {canUpdate && <button onClick={() => startEditItem(it)} className="rounded-lg p-1.5 hover:bg-accent-soft" title="Edit"><Pencil className="h-4 w-4" /></button>}
                      {canDelete && <button onClick={() => removeItem(it)} className="rounded-lg p-1.5 text-danger hover:bg-danger/10" title="Delete"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  </div>
                ))}
                {detail.items.length === 0 && <p className="py-8 text-center text-sm text-muted">No items yet.</p>}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
