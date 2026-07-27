"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { env } from "@/lib/config/env";

export function NewsletterForm({ placeholder, cta, successCode }: { placeholder: string; cta: string; successCode: string | null }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`${env.apiBaseUrl}/storefront/${env.storeSlug}/subscribe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json?.message as string) || "Couldn't subscribe — please try again.");
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto mt-8 flex max-w-md items-center justify-center gap-2 rounded-full bg-canvas px-6 py-4 text-sm font-medium text-ink">
        <Check className="h-4 w-4 text-accent" /> You&apos;re on the list!
        {successCode ? <span>Use <span className="font-mono font-semibold">{successCode}</span> at checkout.</span> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto mt-8 max-w-md">
      <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={placeholder}
          className="h-13 flex-1 rounded-full bg-canvas px-6 text-sm text-ink outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={busy}
          className="flex h-13 items-center justify-center gap-2 rounded-full bg-ink px-8 text-xs font-semibold uppercase tracking-widest text-canvas hover:opacity-90 disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} {cta}
        </button>
      </form>
      {error && <p className="mt-2 text-center text-xs text-canvas/90">{error}</p>}
    </div>
  );
}
