"use client";

import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { Field } from "@/components/ui/form-fields";
import { cn } from "@/lib/utils/cn";

type Settings = Record<string, any>;

export default function SettingsPage() {
  const { storeId, hasPermission } = useAdminAuth();
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

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
    if (!s) return;
    setSaving(true);
    await api.put(`/stores/settings${q}`, { settings: s }, { auth: true });
    setSaving(false);
    setStatus("Saved");
  }

  if (!s) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;

  return (
    <div className="w-full">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-medium">Site Settings</h1>
        <p className="text-sm text-muted">Your website's identity, contact and defaults.</p>
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
          {status && <span className="flex items-center gap-1 text-sm text-accent"><Check className="h-4 w-4" /> {status}</span>}
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-full bg-accent px-8 py-3 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save settings
          </button>
        </div>
      )}
    </div>
  );
}
