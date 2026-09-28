"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Mail, Trash2, Check } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { PageHeader } from "@/components/admin/page-header";

type Scope = "transactions" | "everything";
type Summary = {
  transactions: Record<string, number>;
  everything: Record<string, number>;
  emailReady: boolean;
};

const ACTIONS: Record<Scope, { title: string; button: string; deletes: string[]; keeps: string[] }> = {
  transactions: {
    title: "Delete all transaction data",
    button: "Delete transactions",
    deletes: [
      "All orders, order history, returns and refund records",
      "All customer accounts and their logins, addresses, carts, wishlists",
      "Reviews, Q&A, newsletter and back-in-stock subscribers, notifications",
      "Customer photos (review and personalisation uploads)",
      "Stock movement history and the audit log",
      "Custom option lists — masters go back to the standard Size, Colour, Fabric…",
    ],
    keeps: ["Products, categories, collections, current stock", "Discounts (usage reset), campaigns", "Admins, settings, theme, integration keys"],
  },
  everything: {
    title: "Delete all data and restart fresh",
    button: "Restart fresh",
    deletes: [
      "Everything in \"Delete all transaction data\"",
      "All products, variants, images, categories, collections, brands",
      "All discounts and campaigns",
      "All Admin and Staff accounts and their logins",
    ],
    keeps: ["Super Admin logins", "Site settings, theme, home-page config, roles, sellers, customer groups", "Integration keys"],
  },
};

const COUNT_LABELS: Record<string, string> = {
  orders: "orders", returns: "returns", customers: "customers", reviews: "reviews", products: "products",
  categories: "categories", collections: "collections", brands: "brands", discounts: "discounts", campaigns: "campaigns", admins: "admins/staff",
};

export default function DangerZonePage() {
  const { profile } = useAdminAuth();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [open, setOpen] = useState<Scope | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const isSuper = profile?.role === "SUPER_ADMIN";

  const load = async () => setSummary(await api.get<Summary>("/data-reset/summary", { auth: true }));

  useEffect(() => {
    if (!isSuper) return;
    (async () => setSummary(await api.get<Summary>("/data-reset/summary", { auth: true })))();
  }, [isSuper]);

  if (profile && !isSuper) return <p className="p-6 text-sm text-muted">Only Super Admins can open this page.</p>;
  if (!summary) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;

  return (
    <div className="w-full">
      <PageHeader title="Danger Zone" description="Permanently delete data across the whole platform. Each action needs a verification code sent to your email." />

      {!summary.emailReady && (
        <p className="mb-4 rounded-xl border border-line bg-card px-4 py-3 text-xs text-muted">
          Email isn&apos;t set up in <b>Integrations → Email</b>. Locally the verification code prints in the server log; on the live server these actions stay blocked until email works.
        </p>
      )}
      {done && (
        <p className="mb-4 flex items-center gap-2 rounded-xl border border-line bg-card px-4 py-3 text-sm text-accent"><Check className="h-4 w-4" /> {done}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {(Object.keys(ACTIONS) as Scope[]).map((scope) => {
          const a = ACTIONS[scope];
          const counts = scope === "transactions" ? summary.transactions : { ...summary.transactions, ...summary.everything };
          return (
            <section key={scope} className="rounded-2xl border border-danger/40 bg-card p-5">
              <h2 className="flex items-center gap-2 font-display text-lg text-danger"><AlertTriangle className="h-5 w-5" /> {a.title}</h2>
              <p className="mt-2 text-xs text-muted">
                Right now: {Object.entries(counts).map(([k, v]) => `${v} ${COUNT_LABELS[k] ?? k}`).join(" · ")}
              </p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-danger">Deletes</p>
                  <ul className="mt-2 space-y-1 text-xs text-ink">{a.deletes.map((d) => <li key={d}>• {d}</li>)}</ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">Keeps</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted">{a.keeps.map((d) => <li key={d}>• {d}</li>)}</ul>
                </div>
              </div>
              <button
                onClick={() => { setDone(null); setOpen(scope); }}
                className="mt-5 flex items-center gap-2 rounded-full bg-danger px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-white hover:opacity-90"
              >
                <Trash2 className="h-4 w-4" /> {a.button}
              </button>
            </section>
          );
        })}
      </div>

      {open && (
        <ResetDialog
          scope={open}
          email={profile?.email ?? ""}
          onClose={() => setOpen(null)}
          onDone={async (message) => { setOpen(null); setDone(message); await load(); }}
        />
      )}
    </div>
  );
}

function ResetDialog({ scope, email, onClose, onDone }: { scope: Scope; email: string; onClose: () => void; onDone: (message: string) => void }) {
  const a = ACTIONS[scope];
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typed = confirm === "DELETE";

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/data-reset/send-code", { scope }, { auth: true });
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      await api.post("/data-reset/run", { scope, code: code.trim(), confirm }, { auth: true });
      onDone(scope === "transactions" ? "All transaction data deleted." : "All data deleted — the platform is fresh.");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-md rounded-2xl border border-line bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger"><AlertTriangle className="h-5 w-5" /></div>
          <div>
            <h3 className="font-display text-lg leading-tight">{a.title}?</h3>
            <p className="mt-1 text-sm text-muted">This permanently deletes data for the whole platform. It cannot be undone.</p>
          </div>
        </div>

        <label className="block text-xs text-muted">
          Type <b className="text-ink">DELETE</b> to confirm
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} disabled={sent} className="mt-1 h-10 w-full rounded-lg border border-line bg-transparent px-3 text-sm text-ink" />
        </label>

        {!sent ? (
          <button onClick={sendCode} disabled={!typed || busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-line py-2.5 text-xs font-semibold uppercase tracking-widest hover:border-danger hover:text-danger disabled:opacity-40">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Email a code to {email}
          </button>
        ) : (
          <>
            <label className="mt-4 block text-xs text-muted">
              Verification code sent to <b className="text-ink">{email}</b>
              <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={8} autoFocus className="mt-1 h-10 w-full rounded-lg border border-line bg-transparent px-3 text-center font-mono text-lg tracking-[0.4em] text-ink" />
            </label>
            <button onClick={sendCode} disabled={busy} className="mt-1 text-xs text-muted hover:text-ink">Resend code</button>
          </>
        )}

        {error && <p className="mt-3 text-xs text-danger">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="rounded-full border border-line px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted hover:text-ink">Cancel</button>
          <button onClick={run} disabled={!sent || code.length < 4 || busy} className="flex items-center gap-2 rounded-full bg-danger px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-white hover:opacity-90 disabled:opacity-40">
            {busy && sent && <Loader2 className="h-4 w-4 animate-spin" />} Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}
