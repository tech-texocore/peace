"use client";

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Loader2, ExternalLink, RotateCcw, Star, ShoppingBag } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { DEFAULT_THEME } from "@/lib/site-config";
import { cn } from "@/lib/utils/cn";

type Config = Record<string, any>;
type Colors = { accent: string; accentForeground: string; accentSoft: string };

const PRESETS: { name: string; colors: Colors }[] = [
  { name: "Sage", colors: { accent: "#3c5341", accentForeground: "#f6f3ec", accentSoft: "#e7ece2" } },
  { name: "Indigo", colors: { accent: "#3b3a7a", accentForeground: "#f4f4fb", accentSoft: "#e6e6f4" } },
  { name: "Maroon", colors: { accent: "#7a2e33", accentForeground: "#fbf3f2", accentSoft: "#f4e4e3" } },
  { name: "Teal", colors: { accent: "#1f6f6b", accentForeground: "#f0faf9", accentSoft: "#dcefed" } },
  { name: "Charcoal", colors: { accent: "#26262b", accentForeground: "#f5f5f5", accentSoft: "#e8e8ea" } },
  { name: "Amber", colors: { accent: "#a55e12", accentForeground: "#fdf6ec", accentSoft: "#f6e8d4" } },
];

const isHex = (v: string) => /^#[0-9a-fA-F]{3,8}$/.test(v.trim());

function ColorField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      <div className="flex items-center gap-2">
        <span className="relative h-11 w-12 shrink-0 overflow-hidden rounded-lg border border-line">
          <input type="color" value={isHex(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} className="absolute -inset-2 h-[calc(100%+1rem)] w-[calc(100%+1rem)] cursor-pointer border-0 bg-transparent p-0" />
        </span>
        <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="#3c5341" className={cn("h-11 w-full rounded-lg border bg-canvas px-3 font-mono text-sm outline-none focus:border-accent", isHex(value) ? "border-line" : "border-danger")} />
      </div>
      <span className="mt-1 block text-xs text-muted/70">{hint}</span>
    </label>
  );
}

export default function ThemePage() {
  const { storeId, hasPermission } = useAdminAuth();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const q = storeId ? `?storeId=${storeId}` : "";
  const canEdit = hasPermission("config.update");
  const canPublish = hasPermission("config.publish");

  useEffect(() => {
    if (storeId === null) return;
    (async () => {
      const data = await api.get<{ draft: Config }>(`/site-config${q}`, { auth: true });
      setDraft(data.draft);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const colors: Colors = { ...DEFAULT_THEME.colors, ...(draft?.theme?.colors ?? {}) };

  function setColor(key: keyof Colors, value: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      next.theme ??= { colors: { ...DEFAULT_THEME.colors } };
      next.theme.colors = { ...DEFAULT_THEME.colors, ...next.theme.colors, [key]: value };
      return next;
    });
    setStatus(null);
  }

  function applyPreset(c: Colors) {
    setDraft((prev) => (prev ? { ...structuredClone(prev), theme: { colors: { ...c } } } : prev));
    setStatus(null);
  }

  const valid = isHex(colors.accent) && isHex(colors.accentForeground) && isHex(colors.accentSoft);

  async function saveDraft() {
    if (!draft || !valid) return;
    setSaving(true);
    await api.put(`/site-config/draft${q}`, { draft }, { auth: true });
    setSaving(false);
    setStatus("Draft saved");
  }

  async function publish() {
    if (!draft || !valid) return;
    const ok = await confirm({
      title: "Publish theme to the storefront?",
      message: "The new colours will go live for all customers immediately.",
      confirmLabel: "Publish",
    });
    if (!ok) return;
    setPublishing(true);
    await api.put(`/site-config/draft${q}`, { draft }, { auth: true });
    await api.post(`/site-config/publish${q}`, {}, { auth: true });
    setPublishing(false);
    setStatus("Published — live on the storefront");
  }

  if (loading || !draft) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;
  }

  const previewVars = {
    "--accent": colors.accent,
    "--accent-foreground": colors.accentForeground,
    "--accent-soft": colors.accentSoft,
  } as CSSProperties;

  return (
    <div className="w-full pb-24">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium">Theme</h1>
          <p className="mt-1 text-sm text-muted">Set your brand accent colours. Applies to buttons, links, badges and highlights across the storefront.</p>
        </div>
        <Link href="/" target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-accent">
          View storefront <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className={cn("grid gap-4 lg:grid-cols-2", !canEdit && "pointer-events-none opacity-70")}>
        <section className="flex flex-col rounded-2xl border border-line bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg leading-tight">Colours</h2>
            <button type="button" onClick={() => applyPreset(DEFAULT_THEME.colors)} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-ink">
              <RotateCcw className="h-3.5 w-3.5" /> Reset to default
            </button>
          </div>
          <div className="space-y-4">
            <ColorField label="Accent" hint="Primary brand colour — buttons, links, active states." value={colors.accent} onChange={(v) => setColor("accent", v)} />
            <ColorField label="Accent text" hint="Text/icon colour shown on top of the accent colour." value={colors.accentForeground} onChange={(v) => setColor("accentForeground", v)} />
            <ColorField label="Accent soft" hint="Light tint for hovers, chips and badge backgrounds." value={colors.accentSoft} onChange={(v) => setColor("accentSoft", v)} />
          </div>

          <div className="mt-6">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">Presets</span>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.name} type="button" onClick={() => applyPreset(p.colors)} className="group flex items-center gap-2 rounded-full border border-line py-1.5 pl-1.5 pr-3 text-sm hover:border-accent">
                  <span className="h-6 w-6 rounded-full border border-black/10" style={{ background: p.colors.accent }} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="flex flex-col rounded-2xl border border-line bg-card p-5">
          <h2 className="mb-4 font-display text-lg leading-tight">Live preview</h2>
          <div style={previewVars} className="space-y-5 rounded-xl border border-line bg-canvas p-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent"><Star className="h-3.5 w-3.5" /> New season</span>
              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">Best seller</span>
            </div>
            <p className="text-lg">Timeless textiles, <span className="font-medium text-accent">gracefully</span> woven.</p>
            <div className="flex flex-wrap items-center gap-3">
              <button className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground">
                <ShoppingBag className="h-4 w-4" /> Add to cart
              </button>
              <button className="rounded-full border border-accent px-5 py-2.5 text-sm font-medium text-accent">Wishlist</button>
              <a className="text-sm font-medium text-accent underline">View details</a>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted/70">Preview updates instantly. Publish to apply on the live storefront.</p>
        </section>
      </div>

      {canEdit && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card/95 backdrop-blur md:left-64">
          <div className="flex items-center justify-between gap-3 px-5 py-3 lg:px-6">
            <span className="text-sm text-muted">{status ?? (valid ? "Unsaved changes save to a draft first." : "Enter valid hex colours (e.g. #3c5341).")}</span>
            <div className="flex items-center gap-2">
              <button onClick={saveDraft} disabled={saving || !valid} className="rounded-full border border-line px-5 py-2.5 text-sm font-medium hover:bg-accent-soft disabled:opacity-50">
                {saving ? "Saving…" : "Save draft"}
              </button>
              {canPublish && (
                <button onClick={publish} disabled={publishing || !valid} className="rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50">
                  {publishing ? "Publishing…" : "Publish"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
