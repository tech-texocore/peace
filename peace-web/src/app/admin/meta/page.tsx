"use client";

import { useEffect, useState } from "react";
import { Check, CircleAlert, Copy, Loader2, Plug, RefreshCw, Trash2, Users } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field, SelectField } from "@/components/ui/form-fields";
import { PageHeader } from "@/components/admin/page-header";
import { cn } from "@/lib/utils/cn";

type Overview = {
  pixel: boolean;
  conversionsApi: boolean;
  testMode: boolean;
  domainVerification: boolean;
  adAccount: boolean;
  catalog: { url: string; items: number };
  audiences: number;
};
type Rule = { base: string; groupId?: string; state?: string };
type Audience = { id: string; name: string; audience: Rule; metaAudienceId: string | null; size: number; syncedAt: string | null };
type TestResult = { ok: boolean; message: string };

const MASK = "••••••••";
const FIELDS: { k: string; label: string; secret?: boolean; placeholder?: string }[] = [
  { k: "pixelId", label: "Pixel ID", placeholder: "Events Manager → your dataset" },
  { k: "accessToken", label: "Conversions API access token", secret: true },
  { k: "testEventCode", label: "Test event code (only while testing)", placeholder: "TEST12345" },
  { k: "domainVerification", label: "Domain verification code", placeholder: "Business settings → Domains" },
  { k: "adAccountId", label: "Ad Account ID (audiences)", placeholder: "act_1234567890" },
  { k: "audienceToken", label: "Audience token (ads_management)", secret: true },
];
const BASES: [string, string][] = [
  ["all_customers", "All customers"],
  ["newsletter", "Newsletter subscribers"],
  ["customer_group", "A customer group"],
  ["has_ordered", "Customers who ordered"],
];
const EVENTS = ["PageView", "ViewContent", "Search", "AddToWishlist", "AddToCart", "InitiateCheckout", "Purchase (browser + server)", "CompleteRegistration", "Lead (newsletter)", "Contact"];

export default function MetaAdsPage() {
  const { storeId, profile } = useAdminAuth();
  const confirm = useConfirm();
  const q = storeId ? `?storeId=${storeId}` : "";
  const [overview, setOverview] = useState<Overview | null>(null);
  const [keys, setKeys] = useState<Record<string, string>>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<TestResult | null>(null);
  const [audiences, setAudiences] = useState<Audience[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [draft, setDraft] = useState<{ name: string } & Rule>({ name: "", base: "has_ordered" });
  const [reach, setReach] = useState<{ total: number; eligible: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    const [o, integrations, list] = await Promise.all([
      api.get<Overview>(`/meta/overview${q}`, { auth: true }),
      api.get<Record<string, Record<string, string>>>(`/stores/integrations${q}`, { auth: true }),
      api.get<Audience[]>(`/meta/audiences${q}`, { auth: true }),
    ]);
    const meta = integrations.meta ?? {};
    setOverview(o);
    setKeys(meta);
    setForm(Object.fromEntries(FIELDS.map((f) => [f.k, f.secret ? "" : meta[f.k] ?? ""])));
    setAudiences(list);
  };

  useEffect(() => {
    if (!storeId || profile?.role !== "SUPER_ADMIN") return;
    (async () => {
      await refresh();
      api.get<{ items: { id: string; name: string }[] }>(`/customer-groups${q}`, { auth: true }).then((r) => setGroups(r.items)).catch(() => {});
      api.get<{ facets?: { states: string[] } }>(`/customers${q}&limit=1`, { auth: true }).then((r) => setStates(r.facets?.states ?? [])).catch(() => {});
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, profile?.role]);

  useEffect(() => {
    if (!storeId || profile?.role !== "SUPER_ADMIN") return;
    const rule = { base: draft.base, groupId: draft.groupId || undefined, state: draft.state || undefined };
    const t = setTimeout(() => {
      api.post<{ total: number; eligible: number }>(`/meta/audiences/count${q}`, rule, { auth: true }).then(setReach).catch(() => setReach(null));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, profile?.role, draft.base, draft.groupId, draft.state]);

  async function run(key: string, action: () => Promise<TestResult | void>) {
    setBusy(key);
    setNotice(null);
    try {
      const res = await action();
      if (res) setNotice(res);
    } catch (e) {
      setNotice({ ok: false, message: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  const saveKeys = () =>
    run("save", async () => {
      await api.put(`/stores/integrations${q}`, { integrations: { meta: form } }, { auth: true });
      await refresh();
      return { ok: true, message: "Saved — changes are live" };
    });

  const createAudience = () =>
    run("create", async () => {
      const audience = { base: draft.base, groupId: draft.groupId || undefined, state: draft.state || undefined };
      await api.post(`/meta/audiences${q}`, { name: draft.name.trim(), audience }, { auth: true });
      setDraft({ name: "", base: draft.base });
      await refresh();
      return { ok: true, message: "Audience created and sent to Meta" };
    });

  if (profile && profile.role !== "SUPER_ADMIN") return <p className="p-6 text-sm text-muted">Only the Super Admin can open Meta Ads.</p>;
  if (!overview) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;

  const checklist: [string, boolean, string][] = [
    ["Pixel", overview.pixel, "Tracks shop visits and actions"],
    ["Conversions API", overview.conversionsApi, "Purchases sent from the server too"],
    ["Domain tag", overview.domainVerification, "Verify it in Business settings → Domains"],
    ["Catalog feed", overview.catalog.items > 0, `${overview.catalog.items} products/sizes`],
    ["Audiences", overview.adAccount, overview.adAccount ? `${overview.audiences} synced` : "Needs ad account"],
  ];

  return (
    <div className="w-full">
      <PageHeader title="Meta Ads" description="Facebook & Instagram ads: measure sales, show your products and reach your own customers. Super Admin only." />

      <div className="mb-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {checklist.map(([label, on, detail]) => (
          <div key={label} className="rounded-xl border border-line bg-card px-3 py-2.5">
            <p className={cn("flex items-center gap-1.5 text-sm font-medium", on ? "text-accent" : "text-muted")}>
              {on ? <Check className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />} {label}
            </p>
            <p className="mt-0.5 text-xs text-muted">{detail}</p>
          </div>
        ))}
      </div>
      {overview.testMode && <p className="mb-4 rounded-lg bg-accent-soft/60 px-3 py-2 text-xs text-ink">Test mode is on — events show in Events Manager → Test events. Clear the test event code before running real ads.</p>}
      {notice && (
        <p className={cn("mb-4 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm", notice.ok ? "bg-accent-soft/60 text-accent" : "bg-danger/10 text-danger")}>
          {notice.ok ? <Check className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />} {notice.message}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section className="rounded-2xl border border-line bg-card p-5">
          <h2 className="font-display text-lg">Connection</h2>
          <p className="mb-4 mt-0.5 text-xs text-muted">From Meta Events Manager and Business Settings. Tokens are stored encrypted.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <Field
                key={f.k}
                label={f.label}
                type={f.secret ? "password" : "text"}
                value={form[f.k] ?? ""}
                onChange={(v) => setForm((s) => ({ ...s, [f.k]: v }))}
                placeholder={f.secret && keys[f.k] === MASK ? "Saved — leave blank to keep" : f.placeholder}
              />
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button onClick={saveKeys} disabled={busy !== null} className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90 disabled:opacity-50">
              {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </button>
            <button onClick={() => run("pixel", () => api.post<TestResult>(`/stores/integrations/test/meta${q}`, {}, { auth: true }))} disabled={busy !== null} className="flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-xs font-medium hover:border-accent hover:text-accent disabled:opacity-50">
              {busy === "pixel" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />} Test Pixel
            </button>
            <button onClick={() => run("account", () => api.post<TestResult>(`/meta/test-ad-account${q}`, {}, { auth: true }))} disabled={busy !== null} className="flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-xs font-medium hover:border-accent hover:text-accent disabled:opacity-50">
              {busy === "account" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plug className="h-3.5 w-3.5" />} Test ad account
            </button>
          </div>
          <p className="mt-4 text-xs text-muted">Tracked automatically: {EVENTS.join(" · ")}</p>
        </section>

        <div className="grid gap-4">
          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="font-display text-lg">Product catalog feed</h2>
            <p className="mb-3 mt-0.5 text-xs text-muted">Commerce Manager → Catalogue → Data sources → Data feed → Scheduled feed (daily). Powers catalog ads and Instagram Shop.</p>
            <button type="button" onClick={() => navigator.clipboard.writeText(overview.catalog.url)} className="flex max-w-full items-center gap-1.5 break-all rounded-lg bg-line/40 px-3 py-2 text-left font-mono text-xs text-ink hover:text-accent">
              {overview.catalog.url} <Copy className="h-3.5 w-3.5 shrink-0" />
            </button>
            <p className="mt-2 text-xs text-muted">{overview.catalog.items} items · one per size/colour, grouped by product</p>
          </section>

          <section className="rounded-2xl border border-line bg-card p-5">
            <h2 className="font-display text-lg">Audiences</h2>
            <p className="mb-4 mt-0.5 text-xs text-muted">Send customer groups to Meta for ads and lookalikes. Only customers who agreed to marketing are included; details are hashed before sending.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Audience name" value={draft.name} onChange={(v) => setDraft((d) => ({ ...d, name: v }))} placeholder="e.g. Past buyers" />
              <SelectField label="Who" value={draft.base} onChange={(v) => setDraft((d) => ({ ...d, base: v, groupId: undefined }))}>
                {BASES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </SelectField>
              {draft.base === "customer_group" ? (
                <SelectField label="Group" value={draft.groupId ?? ""} onChange={(v) => setDraft((d) => ({ ...d, groupId: v }))}>
                  <option value="">Select a group…</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </SelectField>
              ) : (
                <SelectField label="Location" value={draft.state ?? ""} onChange={(v) => setDraft((d) => ({ ...d, state: v }))}>
                  <option value="">All locations</option>
                  {states.map((s) => <option key={s} value={s}>{s}</option>)}
                </SelectField>
              )}
              <div className="flex items-end">
                <button onClick={createAudience} disabled={busy !== null || draft.name.trim().length < 2 || !overview.adAccount || !reach?.eligible} className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90 disabled:opacity-50">
                  {busy === "create" && <Loader2 className="h-4 w-4 animate-spin" />} Create & send
                </button>
              </div>
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
              <Users className="h-3.5 w-3.5 text-accent" />
              {reach ? <><b className="text-ink">{reach.eligible}</b>&nbsp;of {reach.total} agreed to marketing and will be sent</> : "Counting…"}
            </p>

            {audiences.length > 0 && (
              <div className="mt-4 divide-y divide-line rounded-xl border border-line">
                {audiences.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{a.name}</p>
                      <p className="text-xs text-muted">
                        {BASES.find(([v]) => v === a.audience?.base)?.[1] ?? a.audience?.base}
                        {a.audience?.state ? ` · ${a.audience.state}` : ""} · {a.size} people
                        {a.syncedAt ? ` · synced ${new Date(a.syncedAt).toLocaleDateString("en-IN")}` : " · not synced"}
                      </p>
                    </div>
                    <button onClick={() => run(`sync-${a.id}`, async () => { await api.post(`/meta/audiences/${a.id}/sync${q}`, {}, { auth: true }); await refresh(); return { ok: true, message: `"${a.name}" synced` }; })} disabled={busy !== null} title="Sync again" className="rounded-lg p-1.5 text-muted hover:bg-accent-soft hover:text-accent disabled:opacity-50">
                      {busy === `sync-${a.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={async () => {
                        if (!(await confirm({ title: `Delete "${a.name}"?`, message: "It is also removed from your Meta ad account.", confirmLabel: "Delete", danger: true }))) return;
                        await run(`del-${a.id}`, async () => { await api.delete(`/meta/audiences/${a.id}${q}`, { auth: true }); await refresh(); });
                      }}
                      disabled={busy !== null}
                      title="Delete"
                      className="rounded-lg p-1.5 text-muted hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
