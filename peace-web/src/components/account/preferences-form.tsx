"use client";

import { useEffect, useState } from "react";
import { Loader2, Check, Lock } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";

interface Category { key: string; label: string; description: string; transactional?: boolean }
interface Prefs {
  channels: { emailOptIn: boolean; smsOptIn: boolean; whatsappOptIn: boolean };
  categories: Record<string, boolean>;
  catalog: Category[];
}

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} disabled={disabled} onClick={onChange}
      className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", on ? "bg-accent" : "bg-black/15", disabled && "opacity-50")}>
      <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform", on ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

const CHANNELS: { key: keyof Prefs["channels"]; label: string; hint: string }[] = [
  { key: "emailOptIn", label: "Email", hint: "Order updates and offers to your inbox" },
  { key: "smsOptIn", label: "SMS", hint: "Text alerts to your mobile" },
  { key: "whatsappOptIn", label: "WhatsApp", hint: "Updates on WhatsApp" },
];

export function PreferencesForm() {
  const [p, setP] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    api.get<Prefs>("/account/preferences", { auth: true }).then(setP).catch(() => setP(null));
  }, []);

  function setChannel(key: keyof Prefs["channels"]) {
    setP((prev) => (prev ? { ...prev, channels: { ...prev.channels, [key]: !prev.channels[key] } } : prev));
    setStatus(null);
  }
  function setCategory(key: string) {
    setP((prev) => (prev ? { ...prev, categories: { ...prev.categories, [key]: !prev.categories[key] } } : prev));
    setStatus(null);
  }

  async function save() {
    if (!p) return;
    setSaving(true);
    const res = await api.patch<Prefs>("/account/preferences", {
      emailOptIn: p.channels.emailOptIn,
      smsOptIn: p.channels.smsOptIn,
      whatsappOptIn: p.channels.whatsappOptIn,
      categories: p.categories,
    }, { auth: true });
    setP(res);
    setSaving(false);
    setStatus("Saved");
  }

  if (!p) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <h1 className="font-display text-xl font-medium">Notification preferences</h1>
        <p className="text-sm text-muted">Choose how we reach you and what you want to hear about.</p>
      </div>

      <div className="space-y-5 rounded-2xl border border-line bg-card p-6">
        <div>
          <span className="mb-3 block text-xs font-semibold uppercase tracking-wide text-muted">How we reach you</span>
          <div className="space-y-3">
            {CHANNELS.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="text-xs text-muted">{c.hint}</p>
                </div>
                <Toggle on={p.channels[c.key]} onChange={() => setChannel(c.key)} />
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-line pt-5">
          <span className="mb-3 block text-xs font-semibold uppercase tracking-wide text-muted">What you hear about</span>
          <div className="space-y-3">
            {p.catalog.map((cat) => (
              <div key={cat.key} className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">{cat.label}</p>
                  <p className="text-xs text-muted">{cat.description}</p>
                </div>
                {cat.transactional ? (
                  <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted"><Lock className="h-3.5 w-3.5" /> Always on</span>
                ) : (
                  <Toggle on={p.categories[cat.key] !== false} onChange={() => setCategory(cat.key)} />
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">Order updates are always sent so you never miss delivery and returns information.</p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3">
        {status && <span className="flex items-center gap-1 text-sm text-accent"><Check className="h-4 w-4" /> {status}</span>}
        <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-full bg-accent px-8 py-3 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90 disabled:opacity-50">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save preferences
        </button>
      </div>
    </div>
  );
}
