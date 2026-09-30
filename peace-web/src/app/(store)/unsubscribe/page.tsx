"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, MailX } from "lucide-react";
import { api } from "@/lib/api/client";

function Unsubscribe() {
  const token = useSearchParams().get("t") ?? "";
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">(token ? "idle" : "error");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(token ? "" : "This unsubscribe link is not valid.");

  async function confirm() {
    setState("busy");
    try {
      const res = await api.post<{ email: string }>("/subscriptions/newsletter/unsubscribe", { token });
      setEmail(res.email);
      setState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      setState("error");
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      {state === "done" ? (
        <>
          <CheckCircle2 className="mx-auto h-10 w-10 text-accent" />
          <h1 className="mt-4 font-display text-2xl">You&apos;re unsubscribed</h1>
          <p className="mt-2 text-sm text-muted">{email} won&apos;t get our newsletter any more. Order emails still arrive as usual.</p>
        </>
      ) : (
        <>
          <MailX className="mx-auto h-10 w-10 text-accent" />
          <h1 className="mt-4 font-display text-2xl">Unsubscribe from our newsletter?</h1>
          <p className="mt-2 text-sm text-muted">You&apos;ll stop getting offers and updates by email. Order emails are not affected.</p>
          {error && <p className="mt-4 text-sm text-danger">{error}</p>}
          {token && (
            <button onClick={confirm} disabled={state === "busy"} className="mt-6 inline-flex items-center gap-2 rounded-full bg-accent px-8 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50">
              {state === "busy" && <Loader2 className="h-4 w-4 animate-spin" />} Unsubscribe
            </button>
          )}
        </>
      )}
      <p className="mt-8"><Link href="/" className="text-sm text-muted hover:text-accent">← Back to the shop</Link></p>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense>
      <Unsubscribe />
    </Suspense>
  );
}
