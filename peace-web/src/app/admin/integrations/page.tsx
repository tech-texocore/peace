"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { Field } from "@/components/ui/form-fields";
import { PageHeader } from "@/components/admin/page-header";
import { cn } from "@/lib/utils/cn";

type Integrations = Record<string, Record<string, string>>;

const GROUPS = [
  { key: "razorpay", label: "Razorpay — Payments", hint: "Accept online payments (UPI, cards, netbanking). Get these from your Razorpay Dashboard → Settings → API Keys.", fields: [{ k: "keyId", label: "Key ID" }, { k: "keySecret", label: "Key Secret", secret: true }] },
  { key: "bluedart", label: "BlueDart — Courier", hint: "Print shipping labels and track deliveries. Get these from your BlueDart account manager.", fields: [{ k: "loginId", label: "Login ID" }, { k: "licenseKey", label: "License Key", secret: true }] },
  { key: "whatsapp", label: "WhatsApp Business", hint: "Send order updates on WhatsApp. From Meta WhatsApp Business.", fields: [{ k: "phoneNumberId", label: "Phone Number ID" }, { k: "accessToken", label: "Access Token", secret: true }] },
  { key: "sms", label: "SMS", hint: "Send OTP and order texts. From your SMS provider (e.g. MSG91).", fields: [{ k: "senderId", label: "Sender ID" }, { k: "apiKey", label: "API Key", secret: true }] },
];

export default function IntegrationsPage() {
  const { storeId, hasPermission } = useAdminAuth();
  const [data, setData] = useState<Integrations | null>(null);
  const [form, setForm] = useState<Integrations>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const q = storeId ? `?storeId=${storeId}` : "";
  const canEdit = hasPermission("integrations.update");

  useEffect(() => {
    if (storeId === null) return;
    (async () => {
      const d = await api.get<Integrations>(`/stores/integrations${q}`, { auth: true });
      setData(d);
      // prefill non-secret fields; secrets stay blank
      const init: Integrations = {};
      for (const g of GROUPS) {
        init[g.key] = {};
        for (const f of g.fields) init[g.key][f.k] = f.secret ? "" : d?.[g.key]?.[f.k] ?? "";
      }
      setForm(init);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  function set(group: string, key: string, value: string) {
    setForm((f) => ({ ...f, [group]: { ...f[group], [key]: value } }));
    setStatus(null);
  }

  async function save() {
    setSaving(true);
    const res = await api.put<Integrations>(`/stores/integrations${q}`, { integrations: form }, { auth: true });
    setData(res);
    setSaving(false);
    setStatus("Saved");
  }

  const configured = (group: string, key: string) => data?.[group]?.[key] === "••••••••";

  if (!data) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;

  return (
    <div className="w-full">
      <PageHeader title="Integrations" description="Connect your own payment, delivery and messaging accounts. Everything works in test mode until you add real keys." />

      <div className={cn("grid gap-4 lg:grid-cols-2 lg:items-start", !canEdit && "pointer-events-none opacity-70")}>
        {GROUPS.map((g) => (
          <section key={g.key} className="rounded-2xl border border-line bg-card p-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">{g.label}</h2>
            <p className="mb-4 mt-1 text-xs text-muted">{g.hint}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {g.fields.map((f) => (
                <div key={f.k}>
                  <Field
                    label={f.label}
                    type={f.secret ? "password" : "text"}
                    value={form[g.key]?.[f.k] ?? ""}
                    onChange={(v) => set(g.key, f.k, v)}
                    placeholder={f.secret && configured(g.key, f.k) ? "•••• configured (leave blank to keep)" : ""}
                  />
                  {f.secret && configured(g.key, f.k) && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-accent"><ShieldCheck className="h-3 w-3" /> Configured</p>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {canEdit && (
        <div className="sticky bottom-4 mt-6 flex items-center justify-end gap-3">
          {status && <span className="flex items-center gap-1 text-sm text-accent"><Check className="h-4 w-4" /> {status}</span>}
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-full bg-accent px-8 py-3 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save keys
          </button>
        </div>
      )}
    </div>
  );
}
