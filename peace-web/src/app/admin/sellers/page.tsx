"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Loader2, Plus, Trash2, Store, Pencil, Search, Star, ChevronDown } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field, SelectField, AddressFields, Label, type AddressValue } from "@/components/ui/form-fields";
import { ImageUpload } from "@/components/ui/image-upload";
import { getMasterItems, type MasterItem } from "@/lib/masters";
import { cn } from "@/lib/utils/cn";

type SellerStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";

interface SellerRow {
  id: string;
  name: string;
  legalName?: string | null;
  businessType?: string | null;
  gstin?: string | null;
  pan?: string | null;
  email?: string | null;
  phone?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  description?: string | null;
  logoUrl?: string | null;
  status: SellerStatus;
  isFirstParty: boolean;
  returnable: boolean;
  returnWindowDays: number;
  replacementDays?: number | null;
  dispatchDays: number;
  codAvailable: boolean;
  warrantyInfo?: string | null;
  pickupName?: string | null;
  pickupPhone?: string | null;
  pickupLine1?: string | null;
  pickupLine2?: string | null;
  pickupLandmark?: string | null;
  pickupCity?: string | null;
  pickupDistrict?: string | null;
  pickupState?: string | null;
  pickupPostalCode?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  bankIfsc?: string | null;
  _count: { products: number };
}

interface Form {
  name: string; legalName: string; businessType: string; gstin: string; pan: string;
  email: string; phone: string; supportEmail: string; supportPhone: string;
  description: string; logoUrl: string; status: SellerStatus; isFirstParty: boolean;
  returnable: boolean; returnWindowDays: number; replacementDays: string; dispatchDays: number; codAvailable: boolean; warrantyInfo: string;
  pickupName: string; pickupPhone: string; pickup: AddressValue;
  bankAccountName: string; bankAccountNumber: string; bankIfsc: string;
}

const emptyForm: Form = {
  name: "", legalName: "", businessType: "", gstin: "", pan: "",
  email: "", phone: "", supportEmail: "", supportPhone: "",
  description: "", logoUrl: "", status: "ACTIVE", isFirstParty: false,
  returnable: true, returnWindowDays: 7, replacementDays: "", dispatchDays: 2, codAvailable: true, warrantyInfo: "",
  pickupName: "", pickupPhone: "", pickup: {},
  bankAccountName: "", bankAccountNumber: "", bankIfsc: "",
};

const statusStyle: Record<SellerStatus, string> = {
  ACTIVE: "bg-accent-soft text-accent",
  INACTIVE: "bg-black/5 text-muted dark:bg-white/10",
  SUSPENDED: "bg-danger/10 text-danger",
};

function clean<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== "" && v !== undefined && v !== null)) as Partial<T>;
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted">
        {title}{hint && <span className="ml-1 font-normal normal-case text-muted/70">— {hint}</span>}
      </p>
      {children}
    </div>
  );
}

function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-line bg-canvas px-3 py-2.5">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
        className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", on ? "bg-accent" : "bg-black/15 dark:bg-white/20")}>
        <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform", on ? "translate-x-[22px]" : "translate-x-0.5")} />
      </button>
    </div>
  );
}

function NumberField({ label, value, onChange, min = 0, max, suffix }: { label: string; value: number | string; onChange: (v: string) => void; min?: number; max?: number; suffix?: string }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <div className="relative">
        <input type="number" min={min} max={max} value={value} onChange={(e) => onChange(e.target.value)}
          className="h-11 w-full rounded-lg border border-line bg-canvas px-3 pr-14 text-sm outline-none focus:border-accent" />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted">{suffix}</span>}
      </div>
    </label>
  );
}

function FilterSelect({ value, onChange, children }: { value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="h-10 appearance-none rounded-full border border-line bg-card pl-4 pr-9 text-sm outline-none focus:border-accent">
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

export default function SellersPage() {
  const { storeId, hasPermission } = useAdminAuth();
  const confirm = useConfirm();
  const [rows, setRows] = useState<SellerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"" | SellerStatus>("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessTypes, setBusinessTypes] = useState<MasterItem[]>([]);

  const canCreate = hasPermission("sellers.create");
  const canUpdate = hasPermission("sellers.update");
  const canDelete = hasPermission("sellers.delete");
  const q = storeId ? `storeId=${storeId}` : "";
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const params = new URLSearchParams(q);
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    const res = await api.get<{ items: SellerRow[]; total: number }>(`/sellers?${params}`, { auth: true });
    setRows(res.items);
    setTotal(res.total);
    setLoading(false);
  }, [storeId, q, search, status]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (storeId) getMasterItems("business_type", storeId).then(setBusinessTypes); }, [storeId]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  }

  function startEdit(s: SellerRow) {
    setEditingId(s.id);
    setForm({
      name: s.name, legalName: s.legalName ?? "", businessType: s.businessType ?? "", gstin: s.gstin ?? "", pan: s.pan ?? "",
      email: s.email ?? "", phone: s.phone ?? "", supportEmail: s.supportEmail ?? "", supportPhone: s.supportPhone ?? "",
      description: s.description ?? "", logoUrl: s.logoUrl ?? "", status: s.status, isFirstParty: s.isFirstParty,
      returnable: s.returnable, returnWindowDays: s.returnWindowDays, replacementDays: s.replacementDays?.toString() ?? "",
      dispatchDays: s.dispatchDays, codAvailable: s.codAvailable, warrantyInfo: s.warrantyInfo ?? "",
      pickupName: s.pickupName ?? "", pickupPhone: s.pickupPhone ?? "",
      pickup: { line1: s.pickupLine1 ?? "", line2: s.pickupLine2 ?? "", landmark: s.pickupLandmark ?? "", city: s.pickupCity ?? "", district: s.pickupDistrict ?? "", state: s.pickupState ?? "", postalCode: s.pickupPostalCode ?? "" },
      bankAccountName: s.bankAccountName ?? "", bankAccountNumber: s.bankAccountNumber ?? "", bankIfsc: s.bankIfsc ?? "",
    });
    setError(null);
    setShowForm(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const payload = {
      ...clean({
        name: form.name, legalName: form.legalName, businessType: form.businessType,
        gstin: form.gstin.toUpperCase(), pan: form.pan.toUpperCase(),
        email: form.email, phone: form.phone, supportEmail: form.supportEmail, supportPhone: form.supportPhone,
        description: form.description, logoUrl: form.logoUrl, status: form.status,
        warrantyInfo: form.warrantyInfo, bankAccountName: form.bankAccountName, bankAccountNumber: form.bankAccountNumber,
        bankIfsc: form.bankIfsc.toUpperCase(),
        pickupName: form.pickupName, pickupPhone: form.pickupPhone,
        pickupLine1: form.pickup.line1, pickupLine2: form.pickup.line2, pickupLandmark: form.pickup.landmark,
        pickupCity: form.pickup.city, pickupDistrict: form.pickup.district, pickupState: form.pickup.state, pickupPostalCode: form.pickup.postalCode,
      }),
      isFirstParty: form.isFirstParty,
      returnable: form.returnable,
      returnWindowDays: form.returnWindowDays,
      dispatchDays: form.dispatchDays,
      codAvailable: form.codAvailable,
      ...(form.replacementDays !== "" ? { replacementDays: Number(form.replacementDays) } : {}),
    };
    try {
      if (editingId) await api.patch(`/sellers/${editingId}?${q}`, payload, { auth: true });
      else await api.post(`/sellers?${q}`, payload, { auth: true });
      setShowForm(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(s: SellerRow) {
    const ok = await confirm({ title: "Delete this seller?", message: `${s.name} will be permanently removed.`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    try {
      await api.delete(`/sellers/${s.id}?${q}`, { auth: true });
      setRows((r) => r.filter((x) => x.id !== s.id));
    } catch (err) {
      await confirm({ title: "Cannot delete", message: (err as Error).message, confirmLabel: "OK" });
    }
  }

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium">Sellers</h1>
          <p className="mt-1 text-sm text-muted">Businesses that list products on your platform. You create and manage them here.</p>
        </div>
        {canCreate && !showForm && (
          <button onClick={startCreate} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> New seller
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="mb-6 space-y-6 rounded-2xl border border-line bg-card p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg">{editingId ? "Edit seller" : "New seller"}</h2>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isFirstParty} onChange={(e) => set({ isFirstParty: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
              <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-accent" /> First-party (your own store)</span>
            </label>
          </div>

          <Section title="Brand & identity">
            <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
              <ImageUpload label="Logo" value={form.logoUrl} folder="sellers" onChange={(url) => set({ logoUrl: url })} hint="Recommended 400 × 400px (square) · transparent PNG · under 5 MB" />
              <div className="grid content-start gap-4 sm:grid-cols-2">
                <Field label="Display name" required placeholder="e.g. Anaya Handlooms" value={form.name} onChange={(v) => set({ name: v })} />
                <SelectField label="Status" value={form.status} onChange={(v) => set({ status: v as SellerStatus })}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="SUSPENDED">Suspended</option>
                </SelectField>
                <div className="sm:col-span-2">
                  <Field label="About / description" textarea placeholder="Short description shown to customers on the storefront." value={form.description} onChange={(v) => set({ description: v })} />
                </div>
              </div>
            </div>
          </Section>

          <Section title="Legal & tax">
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Legal / registered name" placeholder="e.g. Anaya Textiles Pvt Ltd" value={form.legalName} onChange={(v) => set({ legalName: v })} />
              <SelectField label="Business type" value={form.businessType} onChange={(v) => set({ businessType: v })}>
                <option value="">Select type…</option>
                {businessTypes.map((t) => <option key={t.id} value={t.value}>{t.label}</option>)}
              </SelectField>
              <Field label="GSTIN" placeholder="e.g. 29ABCDE1234F1Z5" value={form.gstin} onChange={(v) => set({ gstin: v.toUpperCase() })} />
              <Field label="PAN" placeholder="e.g. ABCDE1234F" value={form.pan} onChange={(v) => set({ pan: v.toUpperCase() })} />
            </div>
          </Section>

          <Section title="Contact">
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Business email" type="email" placeholder="seller@example.com" value={form.email} onChange={(v) => set({ email: v })} />
              <Field label="Business phone" placeholder="10-digit mobile" value={form.phone} onChange={(v) => set({ phone: v })} />
              <Field label="Support email" type="email" placeholder="support@example.com" value={form.supportEmail} onChange={(v) => set({ supportEmail: v })} />
              <Field label="Support phone" placeholder="Customer-care number" value={form.supportPhone} onChange={(v) => set({ supportPhone: v })} />
            </div>
          </Section>

          <Section title="Pickup address" hint="where couriers collect shipments">
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Contact name" placeholder="Warehouse contact" value={form.pickupName} onChange={(v) => set({ pickupName: v })} />
              <Field label="Contact phone" placeholder="10-digit mobile" value={form.pickupPhone} onChange={(v) => set({ pickupPhone: v })} />
            </div>
            <div className="mt-4">
              <AddressFields value={form.pickup} onChange={(patch) => setForm((f) => ({ ...f, pickup: { ...f.pickup, ...patch } }))} requireLine1={false} />
            </div>
          </Section>

          <Section title="Policies" hint="defaults for this seller; a product can override the return rule">
            <div className="grid gap-4 lg:grid-cols-2">
              <Toggle label="Returns accepted" hint="Allow customers to return items" on={form.returnable} onChange={(v) => set({ returnable: v })} />
              <Toggle label="Cash on delivery" hint="Offer COD for this seller" on={form.codAvailable} onChange={(v) => set({ codAvailable: v })} />
              <NumberField label="Return window" value={form.returnWindowDays} onChange={(v) => set({ returnWindowDays: Number(v) })} min={0} max={365} suffix="days" />
              <NumberField label="Replacement window" value={form.replacementDays} onChange={(v) => set({ replacementDays: v })} min={0} max={365} suffix="days" />
              <NumberField label="Dispatch time" value={form.dispatchDays} onChange={(v) => set({ dispatchDays: Number(v) })} min={0} max={60} suffix="days" />
              <Field label="Warranty info" placeholder="e.g. 6-month manufacturer warranty" value={form.warrantyInfo} onChange={(v) => set({ warrantyInfo: v })} />
            </div>
          </Section>

          <Section title="Bank details" hint="for payouts">
            <div className="grid gap-4 lg:grid-cols-3">
              <Field label="Account holder" placeholder="Name on account" value={form.bankAccountName} onChange={(v) => set({ bankAccountName: v })} />
              <Field label="Account number" placeholder="Account number" value={form.bankAccountNumber} onChange={(v) => set({ bankAccountNumber: v })} />
              <Field label="IFSC" placeholder="e.g. HDFC0001234" value={form.bankIfsc} onChange={(v) => set({ bankIfsc: v.toUpperCase() })} />
            </div>
          </Section>

          {error && <p className="text-sm text-danger">{error}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-full bg-ink px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-canvas hover:opacity-90 disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {editingId ? "Save changes" : "Create seller"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-muted">Cancel</button>
          </div>
        </form>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or GSTIN…" className="h-10 rounded-full border border-line bg-card pl-9 pr-4 text-sm outline-none focus:border-accent" />
        </div>
        <FilterSelect value={status} onChange={(v) => setStatus(v as "" | SellerStatus)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="SUSPENDED">Suspended</option>
        </FilterSelect>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">Seller</th>
              <th className="px-5 py-3 font-semibold">Contact</th>
              <th className="px-5 py-3 font-semibold">Tax</th>
              <th className="px-5 py-3 font-semibold">Pickup</th>
              <th className="px-5 py-3 font-semibold">Products</th>
              <th className="px-5 py-3 font-semibold">Status</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="py-16 text-center text-sm text-muted">No sellers yet. Create your first seller to start adding products.</td></tr>
            ) : (
              rows.map((s) => (
                <tr key={s.id} className="border-b border-line align-top last:border-0">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-canvas">
                        {s.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={s.logoUrl} alt="" className="h-full w-full object-cover" />
                        ) : <Store className="h-4 w-4 text-muted" />}
                      </span>
                      <div>
                        <span className="flex items-center gap-2 font-medium">
                          {s.name}
                          {s.isFirstParty && <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent"><Star className="h-3 w-3" /> First-party</span>}
                        </span>
                        <span className="block text-xs text-muted">{s.legalName || s.businessType || "—"}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-muted">
                    <span className="block">{s.email || "—"}</span>
                    <span className="block text-xs">{s.phone || ""}</span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-muted">
                    <span className="block">{s.gstin || "—"}</span>
                    <span className="block">{s.pan || ""}</span>
                  </td>
                  <td className="px-5 py-3 text-muted">{[s.pickupCity, s.pickupState].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-5 py-3 text-muted">{s._count.products}</td>
                  <td className="px-5 py-3">
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", statusStyle[s.status])}>{s.status[0] + s.status.slice(1).toLowerCase()}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {canUpdate && <button onClick={() => startEdit(s)} className="rounded-lg p-1.5 hover:bg-accent-soft" title="Edit"><Pencil className="h-4 w-4" /></button>}
                      {canDelete && <button onClick={() => remove(s)} className="rounded-lg p-1.5 text-danger hover:bg-danger/10" title="Delete"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!loading && rows.length > 0 && <p className="mt-3 text-sm text-muted">{total} seller{total === 1 ? "" : "s"}</p>}
    </div>
  );
}
