"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, Package, RotateCcw, CheckCircle2, Loader2 } from "lucide-react";
import { useSiteConfig } from "@/context/site-config-context";
import { api } from "@/lib/api/client";

export default function ContactPage() {
  const { brand } = useSiteConfig();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const valid = form.name.trim() && /.+@.+\..+/.test(form.email) && form.message.trim().length > 3;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true); setError("");
    try { await api.post("/contact", form); setSent(true); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not send. Please try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-5 lg:px-6">
      <h1 className="font-display text-4xl font-medium">Contact us</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted">Questions about an order, a product or a return? Send us a message and the {brand.name} team will get back to you.</p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="rounded-2xl border border-line p-6">
          {sent ? (
            <div className="flex flex-col items-center py-10 text-center">
              <CheckCircle2 className="h-10 w-10 text-accent" />
              <h2 className="mt-3 font-display text-xl">Thank you!</h2>
              <p className="mt-1 text-sm text-muted">We’ve received your message and will reply to <span className="font-medium text-ink">{form.email}</span> soon.</p>
              <button onClick={() => { setSent(false); setForm({ name: "", email: "", subject: "", message: "" }); }} className="mt-5 rounded-full border border-line px-5 py-2 text-sm font-medium hover:bg-accent-soft">Send another</button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Your name *</span><input value={form.name} onChange={set("name")} className="h-11 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" /></label>
                <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Email *</span><input type="email" value={form.email} onChange={set("email")} className="h-11 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" /></label>
              </div>
              <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Subject</span><input value={form.subject} onChange={set("subject")} placeholder="Order, product or return" className="h-11 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" /></label>
              <label className="block"><span className="mb-1 block text-xs font-medium text-muted">Message *</span><textarea value={form.message} onChange={set("message")} rows={5} className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent" /></label>
              {error && <p className="text-sm text-danger">{error}</p>}
              <button type="submit" disabled={!valid || busy} className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground hover:opacity-90 disabled:opacity-50">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Send message</button>
            </form>
          )}
        </div>

        <aside className="space-y-3">
          <InfoCard icon={Clock} title="Response time" text="We usually reply within 24 hours on business days." />
          <InfoCard icon={Package} title="Track your order" text={<>Check status anytime in <Link href="/account/orders" className="text-accent hover:underline">Account → Orders</Link>.</>} />
          <InfoCard icon={RotateCcw} title="Returns & refunds" text={<>See our <Link href="/returns" className="text-accent hover:underline">Returns policy</Link> for how it works.</>} />
        </aside>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <Icon className="h-5 w-5 text-accent" />
      <h3 className="mt-2 text-sm font-medium">{title}</h3>
      <p className="mt-0.5 text-xs leading-relaxed text-muted">{text}</p>
    </div>
  );
}
