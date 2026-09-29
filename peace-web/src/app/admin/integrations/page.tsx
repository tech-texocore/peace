"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, ShieldCheck, Plug, CircleAlert, Copy } from "lucide-react";
import { api } from "@/lib/api/client";
import { env } from "@/lib/config/env";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { Field } from "@/components/ui/form-fields";
import { PageHeader } from "@/components/admin/page-header";
import { cn } from "@/lib/utils/cn";

type Integrations = Record<string, Record<string, string>>;
type FieldDef = { k: string; label: string; secret?: boolean; placeholder?: string; generate?: boolean };
type Group = { key: string; label: string; hint: string; fields: FieldDef[]; testable?: boolean; pending?: boolean; required: string[] };

const MASK = "••••••••";
const WEBHOOK_URL = `${env.apiBaseUrl}/orders/webhook/razorpay`;

const GROUPS: Group[] = [
  {
    key: "razorpay", label: "Razorpay — Payments", testable: true, required: ["keyId", "keySecret"],
    hint: "Online payments (UPI, cards, netbanking). Razorpay Dashboard → Account & Settings → API Keys. Test keys (rzp_test_…) for trial, live keys (rzp_live_…) for real payments. Empty = Cash on Delivery only.",
    fields: [
      { k: "keyId", label: "Key ID", placeholder: "rzp_live_…" },
      { k: "keySecret", label: "Key Secret", secret: true },
      { k: "webhookSecret", label: "Webhook Secret", secret: true, generate: true },
    ],
  },
  {
    key: "bharatship", label: "BharatShip — Courier", testable: true, required: ["email", "password", "pickupAddressId", "courierCode"],
    hint: "Book shipments, live tracking and return pickups from the order screen. Use your app.bharatship.com login. BharatShip needs a courier code on every booking — get your codes from BharatShip support. Empty = ship manually.",
    fields: [
      { k: "email", label: "Login email" },
      { k: "password", label: "Password", secret: true },
      { k: "pickupAddressId", label: "Pickup warehouse ID", placeholder: "From BharatShip → Warehouses" },
      { k: "courierCode", label: "Courier code", placeholder: "From BharatShip support" },
      { k: "defaultWeightGrams", label: "Default parcel weight (grams)", placeholder: "500" },
      { k: "apiBase", label: "API URL", placeholder: "https://app.bharatship.com" },
    ],
  },
  {
    key: "email", label: "Email", testable: true, required: ["fromAddress", "smtpHost"],
    hint: "Order emails and admin verification codes. Free: Gmail (smtp.gmail.com, port 587, your Gmail + an App Password) or Brevo (smtp-relay.brevo.com, port 587, SMTP login + key). Test sends an email to you.",
    fields: [
      { k: "fromAddress", label: "From address", placeholder: "Peace <no-reply@yourdomain.com>" },
      { k: "smtpHost", label: "SMTP host", placeholder: "smtp-relay.brevo.com" },
      { k: "smtpPort", label: "SMTP port", placeholder: "587" },
      { k: "smtpUser", label: "SMTP username" },
      { k: "smtpPass", label: "SMTP password", secret: true },
    ],
  },
  {
    key: "sms", label: "SMS", pending: true, required: ["senderId", "apiKey"],
    hint: "OTP and order texts. From your SMS provider (e.g. MSG91) with DLT-approved sender and templates.",
    fields: [{ k: "senderId", label: "Sender ID" }, { k: "apiKey", label: "API Key", secret: true }],
  },
  {
    key: "whatsapp", label: "WhatsApp Business", pending: true, required: ["phoneNumberId", "accessToken"],
    hint: "Order updates on WhatsApp. From Meta WhatsApp Business (Cloud API) with approved templates.",
    fields: [{ k: "phoneNumberId", label: "Phone Number ID" }, { k: "accessToken", label: "Access Token", secret: true }],
  },
];

const randomSecret = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");

export default function IntegrationsPage() {
  const { storeId, hasPermission } = useAdminAuth();
  const [data, setData] = useState<Integrations | null>(null);
  const [form, setForm] = useState<Integrations>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, { ok: boolean; message: string } | "running">>({});

  const q = storeId ? `?storeId=${storeId}` : "";
  const canEdit = hasPermission("integrations.update");

  function fill(d: Integrations) {
    setData(d);
    const init: Integrations = {};
    for (const g of GROUPS) {
      init[g.key] = {};
      for (const f of g.fields) init[g.key][f.k] = f.secret ? "" : d?.[g.key]?.[f.k] ?? "";
    }
    setForm(init);
  }

  useEffect(() => {
    if (storeId === null) return;
    (async () => fill(await api.get<Integrations>(`/stores/integrations${q}`, { auth: true })))();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  function set(group: string, key: string, value: string) {
    setForm((f) => ({ ...f, [group]: { ...f[group], [key]: value } }));
    setStatus(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      fill(await api.put<Integrations>(`/stores/integrations${q}`, { integrations: form }, { auth: true }));
      setTests({});
      setStatus("Saved — changes are live");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  async function test(group: string) {
    setTests((t) => ({ ...t, [group]: "running" }));
    const res = await api.post<{ ok: boolean; message: string }>(`/stores/integrations/test/${group}${q}`, {}, { auth: true });
    setTests((t) => ({ ...t, [group]: res }));
  }

  const saved = (group: string, key: string) => Boolean(data?.[group]?.[key]);
  const connected = (g: Group) => g.required.every((k) => saved(g.key, k));

  if (!data) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;

  return (
    <div className="w-full">
      <PageHeader title="Integrations" description="Connect your payment, courier and messaging accounts. Keys are stored encrypted and take effect as soon as you save." />

      <div className={cn("grid gap-4 lg:grid-cols-2 lg:items-start", !canEdit && "pointer-events-none opacity-70")}>
        {GROUPS.map((g) => {
          const result = tests[g.key];
          return (
            <section key={g.key} className="rounded-2xl border border-line bg-card p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-muted">{g.label}</h2>
                <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-medium", connected(g) ? "bg-accent/10 text-accent" : "bg-line/60 text-muted")}>
                  {connected(g) ? "Set up" : "Not set"}
                </span>
              </div>
              <p className="mb-4 mt-1 text-xs text-muted">{g.hint}</p>
              {g.pending && (
                <p className="mb-4 rounded-lg bg-line/40 px-3 py-2 text-xs text-muted">Saved keys are kept ready. Messages go live once the sending hookup for this channel is switched on — until then they appear in the server log.</p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                {g.fields.map((f) => (
                  <div key={f.k}>
                    <Field
                      label={f.label}
                      type={f.secret ? "password" : "text"}
                      autoComplete={f.secret ? "new-password" : "off"}
                      data-1p-ignore
                      data-lpignore="true"
                      value={form[g.key]?.[f.k] ?? ""}
                      onChange={(v) => set(g.key, f.k, v)}
                      placeholder={f.secret && saved(g.key, f.k) ? "Saved — leave blank to keep" : f.placeholder ?? ""}
                    />
                    <div className="mt-1 flex items-center gap-3 text-xs">
                      {f.secret && data[g.key]?.[f.k] === MASK && <span className="flex items-center gap-1 text-accent"><ShieldCheck className="h-3 w-3" /> Saved</span>}
                      {f.generate && (
                        <button type="button" onClick={() => set(g.key, f.k, randomSecret())} className="text-accent hover:underline">Generate</button>
                      )}
                    </div>
                    {f.generate && form[g.key]?.[f.k] && (
                      <p className="mt-1 break-all text-xs text-muted">Copy this into Razorpay before saving: <span className="font-mono text-ink">{form[g.key][f.k]}</span></p>
                    )}
                  </div>
                ))}
              </div>

              {g.key === "razorpay" && (
                <div className="mt-4 rounded-lg bg-line/40 px-3 py-2 text-xs text-muted">
                  <p>Razorpay Dashboard → Webhooks → Add: use this URL and the Webhook Secret above. Events: payment.captured, payment.failed, order.paid, refund.processed.</p>
                  <button type="button" onClick={() => navigator.clipboard.writeText(WEBHOOK_URL)} className="mt-1 flex items-center gap-1 font-mono text-ink hover:text-accent">
                    {WEBHOOK_URL} <Copy className="h-3 w-3" />
                  </button>
                </div>
              )}

              {g.testable && (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => test(g.key)} disabled={result === "running"} className="flex items-center gap-2 rounded-full border border-line px-4 py-1.5 text-xs font-medium hover:border-accent hover:text-accent disabled:opacity-50">
                    {result === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />} {g.key === "email" ? "Send test email" : "Test connection"}
                  </button>
                  {result && result !== "running" && (
                    <span className={cn("flex items-center gap-1 text-xs", result.ok ? "text-accent" : "text-danger")}>
                      {result.ok ? <Check className="h-3.5 w-3.5" /> : <CircleAlert className="h-3.5 w-3.5" />} {result.message}
                    </span>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>

      {canEdit && (
        <div className="sticky bottom-4 mt-6 flex items-center justify-end gap-3">
          {error && <span className="flex items-center gap-1 text-sm text-danger"><CircleAlert className="h-4 w-4" /> {error}</span>}
          {status && <span className="flex items-center gap-1 text-sm text-accent"><Check className="h-4 w-4" /> {status}</span>}
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-full bg-accent px-8 py-3 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save keys
          </button>
        </div>
      )}
    </div>
  );
}
