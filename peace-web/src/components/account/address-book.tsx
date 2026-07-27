"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Pencil, Trash2, MapPin, Home, Briefcase, Check } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { AddressFields, Field } from "@/components/ui/form-fields";

interface Address {
  id: string;
  recipientName: string;
  recipientPhone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  district?: string | null;
  state: string;
  postalCode: string;
  country: string;
  type: "HOME" | "WORK" | "OTHER";
  isDefault: boolean;
}

const emptyForm = {
  recipientName: "", recipientPhone: "", line1: "", line2: "", landmark: "",
  postalCode: "", city: "", district: "", state: "", country: "India",
  type: "HOME" as "HOME" | "WORK" | "OTHER", isDefault: false,
};

const typeMeta = {
  HOME: { label: "Home", icon: Home },
  WORK: { label: "Work", icon: Briefcase },
  OTHER: { label: "Other", icon: MapPin },
};

export function AddressBook() {
  const confirm = useConfirm();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [profilePhone, setProfilePhone] = useState("");

  async function load() {
    setAddresses(await api.get<Address[]>("/account/addresses", { auth: true }));
  }
  useEffect(() => {
    (async () => {
      const [me] = await Promise.all([
        api.get<{ phone?: string | null }>("/account/me", { auth: true }),
        load(),
      ]);
      setProfilePhone(me.phone ?? "");
      setLoading(false);
    })();
  }, []);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function patch(p: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...p }));
  }

  function startCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, recipientPhone: profilePhone, isDefault: addresses.length === 0 });
    setFormError(null);
    setShowForm(true);
  }
  function startEdit(a: Address) {
    setEditingId(a.id);
    setForm({
      recipientName: a.recipientName, recipientPhone: a.recipientPhone, line1: a.line1, line2: a.line2 ?? "",
      landmark: a.landmark ?? "", postalCode: a.postalCode, city: a.city, district: a.district ?? "", state: a.state,
      country: a.country, type: a.type, isDefault: a.isDefault,
    });
    setFormError(null);
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!/^\d{6}$/.test(form.postalCode) || !form.city || !form.state) {
      setFormError("Enter a valid PIN code so we can fill City, District and State.");
      return;
    }
    setBusy(true);
    try {
      if (editingId) await api.patch(`/account/addresses/${editingId}`, form, { auth: true });
      else await api.post("/account/addresses", form, { auth: true });
      setShowForm(false);
      await load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(a: Address) {
    const ok = await confirm({ title: "Remove this address?", message: `${a.line1}, ${a.city} — ${a.postalCode}`, confirmLabel: "Remove", danger: true });
    if (!ok) return;
    await api.delete(`/account/addresses/${a.id}`, { auth: true });
    setAddresses((rows) => rows.filter((r) => r.id !== a.id));
  }
  async function makeDefault(a: Address) {
    await api.post(`/account/addresses/${a.id}/default`, {}, { auth: true });
    await load();
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;

  const firstAddress = !editingId && addresses.length === 0;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-medium">Saved addresses</h1>
          <p className="text-sm text-muted">Used at checkout for delivery.</p>
        </div>
        {!showForm && (
          <button onClick={startCreate} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> Add address
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-6 space-y-6 rounded-2xl border border-line bg-card p-5 sm:p-6">
          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">Contact</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Recipient name" required placeholder="e.g. Ranjith Kumar" value={form.recipientName} onChange={(v) => set("recipientName", v)} />
              <div>
                <Field label="Recipient phone" required inputMode="numeric" maxLength={10} placeholder="e.g. 9876543210" value={form.recipientPhone} onChange={(v) => set("recipientPhone", v.replace(/\D/g, ""))} />
                {profilePhone && form.recipientPhone !== profilePhone && (
                  <button type="button" onClick={() => set("recipientPhone", profilePhone)} className="mt-1 text-xs font-medium text-accent">Use my number ({profilePhone})</button>
                )}
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">Address</h3>
            <AddressFields value={form} onChange={patch} />
          </div>

          <div className="flex flex-col gap-4 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              {(Object.keys(typeMeta) as Array<keyof typeof typeMeta>).map((t) => {
                const Icon = typeMeta[t].icon;
                return (
                  <button key={t} type="button" onClick={() => set("type", t)} className={cn("flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-medium transition-colors", form.type === t ? "border-accent bg-accent-soft text-ink" : "border-line text-muted hover:text-ink")}>
                    <Icon className="h-3.5 w-3.5" /> {typeMeta[t].label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <label className={cn("flex items-center gap-2 text-sm", firstAddress && "opacity-70")}>
                Set as default
                <button type="button" role="switch" aria-checked={form.isDefault} disabled={firstAddress} onClick={() => !firstAddress && set("isDefault", !form.isDefault)} className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", form.isDefault ? "bg-accent" : "bg-black/15", firstAddress && "cursor-not-allowed")}>
                  <span className={cn("inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform", form.isDefault ? "translate-x-[22px]" : "translate-x-0.5")} />
                </button>
              </label>
              {firstAddress && <span className="text-xs text-muted">Your first address is set as default.</span>}
            </div>
          </div>

          {formError && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{formError}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-full bg-ink px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-canvas hover:opacity-90 disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {editingId ? "Save address" : "Add address"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-muted">Cancel</button>
            <span className="text-xs text-muted"><span className="text-danger">*</span> required fields</span>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {addresses.length === 0 && !showForm && (
          <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-muted">No addresses yet. Add one for faster checkout.</p>
        )}
        {addresses.map((a) => {
          const Icon = typeMeta[a.type].icon;
          return (
            <div key={a.id} className="rounded-2xl border border-line bg-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-ink"><Icon className="h-3 w-3" /> {typeMeta[a.type].label}</span>
                    {a.isDefault && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">Default</span>}
                  </div>
                  <p className="font-medium">{a.recipientName} · {a.recipientPhone}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    {a.line1}{a.line2 ? `, ${a.line2}` : ""}{a.landmark ? `, near ${a.landmark}` : ""}, {a.city}, {a.district ? `${a.district}, ` : ""}{a.state} — {a.postalCode}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => startEdit(a)} className="rounded-lg p-2 hover:bg-accent-soft" title="Edit"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(a)} className="rounded-lg p-2 text-danger hover:bg-danger/10" title="Delete"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              {!a.isDefault && (
                <div className="mt-4 border-t border-line pt-3">
                  <button onClick={() => makeDefault(a)} className="inline-flex items-center gap-1.5 rounded-full border border-line px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent">
                    <Check className="h-3.5 w-3.5" /> Set as default
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
