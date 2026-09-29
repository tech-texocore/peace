"use client";

import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { Field } from "@/components/ui/form-fields";
import { cn } from "@/lib/utils/cn";

type Settings = Record<string, any>;
type DeliveryMethod = { key: string; label: string; fee: number; days: number; enabled: boolean };
type Shipping = { freeForAll: boolean; freeShippingThreshold: number; codEnabled: boolean; codFee: number; methods: DeliveryMethod[] };
type FreeMode = "none" | "above" | "all";


const FREE_MODES: { mode: FreeMode; label: string }[] = [
  { mode: "none", label: "No free delivery" },
  { mode: "above", label: "Free above an amount" },
  { mode: "all", label: "Free on every order" },
];

const toNumber = (v: string) => Math.max(0, Number(v.replace(/[^\d]/g, "")) || 0);

export default function SettingsPage() {
  const { storeId, hasPermission } = useAdminAuth();
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const q = storeId ? `?storeId=${storeId}` : "";
  const canEdit = hasPermission("settings.update");

  useEffect(() => {
    if (storeId === null) return;
    (async () => setS(await api.get<Settings>(`/stores/settings${q}`, { auth: true })))();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  function set(path: string[], value: unknown) {
    setS((prev) => {
      const next = structuredClone(prev ?? {});
      let node: any = next;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]] ??= {};
      node[path[path.length - 1]] = value;
      return next;
    });
    setStatus(null);
  }

  async function save() {
    if (!s || shippingError) return;
    setSaving(true); setSaveError(null);
    try {
      setS(await api.put<Settings>(`/stores/settings${q}`, { settings: s }, { auth: true }));
      setChosenFreeMode(null);
      setStatus("Saved");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  }


  const shipping = s?.shipping as Shipping | undefined;
  const [chosenFreeMode, setChosenFreeMode] = useState<FreeMode | null>(null);
  const freeMode: FreeMode = chosenFreeMode ?? (shipping?.freeForAll ? "all" : (shipping?.freeShippingThreshold ?? 0) > 0 ? "above" : "none");
  const setShipping = (patch: Partial<Shipping>) => set(["shipping"], { ...shipping, ...patch });
  const setMethod = (i: number, patch: Partial<DeliveryMethod>) =>
    setShipping({ methods: shipping!.methods.map((m, j) => (j === i ? { ...m, ...patch } : m)) });
  const [lastThreshold, setLastThreshold] = useState(0);
  const setFreeMode = (mode: FreeMode) => {
    if (shipping?.freeShippingThreshold) setLastThreshold(shipping.freeShippingThreshold);
    setChosenFreeMode(mode);
    setShipping({ freeForAll: mode === "all", freeShippingThreshold: mode === "above" ? shipping?.freeShippingThreshold || lastThreshold : 0 });
  };
  const shippingError = !shipping
    ? null
    : !shipping.methods.some((m) => m.enabled)
      ? "Keep at least one delivery option on."
      : freeMode === "above" && !(shipping.freeShippingThreshold > 0)
        ? "Enter the order amount for free delivery."
        : null;

  if (!s) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-medium">Site Settings</h1>
        <p className="text-sm text-muted">Your website&apos;s identity, contact and defaults.</p>
      </div>

      <div className={cn("grid gap-4 lg:grid-cols-2 lg:items-start", !canEdit && "pointer-events-none opacity-70")}>
        <div className="space-y-4">
          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted">General</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Site name" value={s.general?.name ?? ""} onChange={(v) => set(["general", "name"], v)} placeholder="Peace" />
              <Field label="Currency" value={s.general?.currency ?? "INR"} onChange={(v) => set(["general", "currency"], v)} placeholder="INR" />
              <div className="sm:col-span-2">
                <Field label="Tagline" value={s.general?.tagline ?? ""} onChange={(v) => set(["general", "tagline"], v)} placeholder="Considered textiles, thoughtfully woven." />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted">SEO defaults</h2>
            <div className="space-y-4">
              <Field label="Default meta title" value={s.seo?.title ?? ""} onChange={(v) => set(["seo", "title"], v)} placeholder="Peace — Considered textiles" />
              <Field label="Default meta description" textarea value={s.seo?.description ?? ""} onChange={(v) => set(["seo", "description"], v)} placeholder="Shop thoughtfully made textiles…" />
            </div>
          </section>
        </div>

        <div className="space-y-4">
          {shipping && (
          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted">Shipping & delivery</h2>
            <p className="mb-4 text-xs text-muted">What customers pay for delivery at checkout. Changes apply as soon as you save.</p>

            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Delivery options</span>
            <div className="space-y-2">
              {shipping.methods.map((m, i) => (
                <div key={m.key} className={cn("grid grid-cols-[auto_1fr_6rem_5rem] items-center gap-3", !m.enabled && "opacity-60")}>
                  <input type="checkbox" checked={m.enabled} onChange={(e) => setMethod(i, { enabled: e.target.checked })} aria-label={`Offer ${m.label}`} className="h-4 w-4 accent-[var(--accent)]" />
                  <Input value={m.label} onChange={(v) => setMethod(i, { label: v })} placeholder="Name" />
                  <Input value={String(m.fee)} onChange={(v) => setMethod(i, { fee: toNumber(v) })} prefix="₹" />
                  <Input value={String(m.days)} onChange={(v) => setMethod(i, { days: Math.max(1, toNumber(v)) })} suffix="days" />
                </div>
              ))}
            </div>


            <span className="mb-1.5 mt-5 block text-xs font-semibold uppercase tracking-wide text-muted">Free delivery</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {FREE_MODES.map((f) => (
                <button key={f.mode} type="button" onClick={() => setFreeMode(f.mode)} className={cn("rounded-xl border px-3 py-2 text-left text-sm", freeMode === f.mode ? "border-accent bg-accent-soft/40 font-medium" : "border-line hover:bg-accent-soft/30")}>
                  {f.label}
                </button>
              ))}
            </div>
            {freeMode === "above" && (
              <div className="mt-3 max-w-[14rem]">
                <Field label="Free when order is at least (₹)" inputMode="numeric" value={shipping.freeShippingThreshold ? String(shipping.freeShippingThreshold) : ""} onChange={(v) => setShipping({ freeShippingThreshold: toNumber(v) })} placeholder="e.g. 999" />
              </div>
            )}
            <p className="mt-2 text-xs text-muted">Free-shipping coupons (Marketing → Discounts) also make delivery free.</p>

            <span className="mb-1.5 mt-5 block text-xs font-semibold uppercase tracking-wide text-muted">Cash on Delivery</span>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={shipping.codEnabled} onChange={(e) => setShipping({ codEnabled: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
                Offer Cash on Delivery
              </label>
              {shipping.codEnabled && (
                <div className="w-40"><Input value={String(shipping.codFee)} onChange={(v) => setShipping({ codFee: toNumber(v) })} prefix="₹" suffix="extra" /></div>
              )}
            </div>

            {shippingError && <p className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-xs text-danger">{shippingError}</p>}
            <p className="mt-5 rounded-lg bg-line/40 px-3 py-2 text-xs text-muted">If you change free delivery, also update texts like “Free shipping over ₹999” in <span className="font-medium text-ink">Site Config</span> (announcement bar and scrolling strip).</p>
          </section>
          )}

          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted">Contact & social</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Support email" type="email" value={s.contact?.email ?? ""} onChange={(v) => set(["contact", "email"], v)} placeholder="support@peace.com" />
              <Field label="Support phone" inputMode="tel" value={s.contact?.phone ?? ""} onChange={(v) => set(["contact", "phone"], v)} placeholder="e.g. 9876543210" />
              <Field label="WhatsApp number" inputMode="tel" value={s.contact?.whatsapp ?? ""} onChange={(v) => set(["contact", "whatsapp"], v)} placeholder="e.g. 9876543210" />
              <Field label="Instagram URL" value={s.social?.instagram ?? ""} onChange={(v) => set(["social", "instagram"], v)} placeholder="https://instagram.com/…" />
              <Field label="Facebook URL" value={s.social?.facebook ?? ""} onChange={(v) => set(["social", "facebook"], v)} placeholder="https://facebook.com/…" />
              <Field label="YouTube URL" value={s.social?.youtube ?? ""} onChange={(v) => set(["social", "youtube"], v)} placeholder="https://youtube.com/…" />
            </div>
          </section>
        </div>

        <p className="rounded-xl border border-dashed border-line px-4 py-3 text-xs text-muted lg:col-span-2">
          <span className="font-medium text-ink">Return rules</span> (window + returnable) are set per <span className="font-medium text-ink">seller / product</span> ·
          <span className="font-medium text-ink"> Legal pages</span> (Terms, Privacy, Returns, Shipping) live under <span className="font-medium text-ink">Content → Pages</span> ·
          <span className="font-medium text-ink"> GSTIN, pickup & bank</span> are in your <span className="font-medium text-ink">Seller profile</span>.
        </p>
      </div>

      {canEdit && (
        <div className="sticky bottom-4 mt-6 flex items-center justify-end gap-3">
          {saveError && <span className="text-sm text-danger">{saveError}</span>}
          {status && <span className="flex items-center gap-1 text-sm text-accent"><Check className="h-4 w-4" /> {status}</span>}
          <button onClick={save} disabled={saving || Boolean(shippingError)} className="flex items-center gap-2 rounded-full bg-accent px-8 py-3 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save settings
          </button>
        </div>
      )}
    </div>
  );
}

function Input({ value, onChange, placeholder, prefix, suffix }: { value: string; onChange: (v: string) => void; placeholder?: string; prefix?: string; suffix?: string }) {
  return (
    <label className="flex h-10 items-center gap-1.5 rounded-lg border border-line bg-canvas px-3 text-sm focus-within:border-accent">
      {prefix && <span className="text-muted">{prefix}</span>}
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} inputMode={prefix || suffix ? "numeric" : undefined} className="w-full min-w-0 bg-transparent outline-none" />
      {suffix && <span className="shrink-0 text-xs text-muted">{suffix}</span>}
    </label>
  );
}
