"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Check, ShieldCheck, ChevronDown, KeyRound } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/context/auth-context";

interface Profile {
  name?: string | null;
  email: string;
  phone?: string | null;
  phoneVerified: boolean;
  gender?: string | null;
  dob?: string | null;
  emailOptIn: boolean;
  smsOptIn: boolean;
  whatsappOptIn: boolean;
}

export function ProfileForm() {
  const [p, setP] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [changing, setChanging] = useState(false);

  const phoneValid = /^\d{10,15}$/.test(phone);

  function startChange() {
    setChanging(true);
    setPhone(p?.phone ?? "");
    setOtpSent(false);
    setOtp("");
    setOtpError(null);
    setDevCode(null);
  }
  function cancelChange() {
    setChanging(false);
    setOtpSent(false);
    setOtp("");
    setOtpError(null);
    setDevCode(null);
  }

  useEffect(() => {
    (async () => {
      const me = await api.get<Profile>("/account/me", { auth: true });
      setP(me);
      setPhone(me.phone ?? "");
    })();
  }, []);

  function field<K extends keyof Profile>(key: K, value: Profile[K]) {
    setP((prev) => (prev ? { ...prev, [key]: value } : prev));
    setStatus(null);
  }

  async function sendOtp() {
    setOtpError(null);
    setOtpBusy(true);
    try {
      const res = await api.post<{ sent: boolean; devCode?: string }>("/account/phone/send-otp", { phone }, { auth: true });
      setOtpSent(true);
      setDevCode(res.devCode ?? null);
    } catch (e) {
      setOtpError((e as Error).message);
    } finally {
      setOtpBusy(false);
    }
  }

  async function verifyOtp() {
    setOtpError(null);
    setOtpBusy(true);
    try {
      await api.post("/account/phone/verify-otp", { phone, code: otp }, { auth: true });
      setP((prev) => (prev ? { ...prev, phone, phoneVerified: true } : prev));
      setOtpSent(false);
      setOtp("");
      setDevCode(null);
      setChanging(false);
    } catch (e) {
      setOtpError((e as Error).message);
    } finally {
      setOtpBusy(false);
    }
  }

  async function save() {
    if (!p) return;
    setSaving(true);
    await api.patch("/account/me", {
      name: p.name,
      gender: p.gender,
      dob: p.dob || undefined,
    }, { auth: true });
    setSaving(false);
    setStatus("Saved");
  }

  if (!p) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;
  }

  const inputCls = "h-11 w-full rounded-lg border border-line bg-card px-3 text-sm outline-none focus:border-accent";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4">
        <h1 className="font-display text-xl font-medium">Personal details</h1>
        <p className="text-sm text-muted">Manage your name, phone and preferences.</p>
      </div>

      <div className="space-y-5 rounded-2xl border border-line bg-card p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Full name</span>
              <input value={p.name ?? ""} onChange={(e) => field("name", e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Email</span>
              <input value={p.email} disabled className={cn(inputCls, "opacity-60")} />
            </label>
          </div>

          <div>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Mobile number</span>
            {p.phoneVerified && !changing ? (
              <div className="flex items-center gap-2 rounded-lg border border-accent/40 bg-accent-soft px-3 py-2.5 text-sm">
                <ShieldCheck className="h-4 w-4 text-accent" /> {p.phone}
                <span className="ml-auto text-xs font-medium text-accent">Verified</span>
                <button onClick={startChange} className="text-xs font-semibold uppercase tracking-wide text-ink underline underline-offset-2">Change</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} placeholder="e.g. 9876543210" className={inputCls} />
                  <button onClick={sendOtp} disabled={otpBusy || !phoneValid} className="shrink-0 rounded-lg bg-ink px-4 text-xs font-semibold uppercase tracking-wide text-canvas hover:opacity-90 disabled:opacity-50">
                    {otpSent ? "Resend" : "Send code"}
                  </button>
                </div>
                {!phoneValid && phone.length > 0 && <p className="text-xs text-muted">Enter a 10-digit mobile number.</p>}
                {otpSent && (
                  <div className="flex gap-2">
                    <input inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="Enter 6-digit code" maxLength={6} className={inputCls} />
                    <button onClick={verifyOtp} disabled={otpBusy || otp.length < 4} className="shrink-0 rounded-lg bg-accent px-4 text-xs font-semibold uppercase tracking-wide text-accent-foreground hover:opacity-90 disabled:opacity-50">
                      Verify
                    </button>
                  </div>
                )}
                {devCode && <p className="text-xs text-accent">Dev code: <span className="font-mono font-semibold">{devCode}</span> (shown in development only)</p>}
                {otpError && <p className="text-xs text-danger">{otpError}</p>}
                {changing && <button onClick={cancelChange} className="text-xs text-muted underline underline-offset-2">Cancel</button>}
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Gender</span>
              <div className="relative">
                <select value={p.gender ?? "UNSPECIFIED"} onChange={(e) => field("gender", e.target.value)} className={cn(inputCls, "appearance-none pr-9")}>
                  <option value="UNSPECIFIED">Prefer not to say</option>
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              </div>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Date of birth</span>
              <input type="date" value={p.dob ? p.dob.slice(0, 10) : ""} onChange={(e) => field("dob", e.target.value)} className={inputCls} />
            </label>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-line pt-5">
            <div>
              <span className="block text-xs font-semibold uppercase tracking-wide text-muted">Notifications</span>
              <p className="mt-1 text-sm text-muted">Manage channels and what you hear about.</p>
            </div>
            <Link href="/account/preferences" className="shrink-0 rounded-full border border-line px-4 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-accent-soft">Preferences</Link>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          {status && <span className="flex items-center gap-1 text-sm text-accent"><Check className="h-4 w-4" /> {status}</span>}
          <button onClick={save} disabled={saving} className="flex items-center gap-2 rounded-full bg-accent px-8 py-3 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90 disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
          </button>
        </div>

        <SecurityCard />
      </div>
  );
}

function SecurityCard() {
  const { hasPasswordLogin, changePassword } = useAuth();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const inputCls = "h-11 w-full rounded-lg border border-line bg-card px-3 text-sm outline-none focus:border-accent";

  function friendly(raw: string) {
    const m = raw.replace("Firebase:", "").trim();
    if (m.includes("wrong-password") || m.includes("invalid-credential")) return "Your current password is incorrect.";
    if (m.includes("weak-password")) return "New password is too weak — use at least 6 characters.";
    if (m.includes("too-many-requests")) return "Too many attempts. Please try again in a moment.";
    if (m.includes("requires-recent-login")) return "Please sign out and sign in again, then change your password.";
    return m || "Couldn't change your password. Please try again.";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setDone(false);
    if (next.length < 6) { setError("New password must be at least 6 characters."); return; }
    if (next !== confirm) { setError("New passwords don't match."); return; }
    setBusy(true);
    try {
      await changePassword(current, next);
      setDone(true); setOpen(false);
      setCurrent(""); setNext(""); setConfirm("");
    } catch (err) {
      setError(friendly((err as Error).message));
    } finally { setBusy(false); }
  }

  return (
    <div className="mt-6 rounded-2xl border border-line bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <KeyRound className="h-4 w-4 text-accent" />
          <div>
            <h2 className="text-sm font-semibold">Password</h2>
            <p className="text-xs text-muted">{hasPasswordLogin ? "Change the password you use to sign in." : "You sign in with Google, so there's no password to change."}</p>
          </div>
        </div>
        {hasPasswordLogin && !open && <button onClick={() => { setOpen(true); setDone(false); }} className="shrink-0 rounded-full border border-line px-4 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-accent-soft">Change password</button>}
        {done && <span className="flex items-center gap-1 text-sm text-accent"><Check className="h-4 w-4" /> Updated</span>}
      </div>

      {hasPasswordLogin && open && (
        <form onSubmit={submit} className="mt-4 space-y-3 border-t border-line pt-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Current password</span>
            <input required type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">New password</span>
              <input required type="password" placeholder="At least 6 characters" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Confirm new password</span>
              <input required type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
            </label>
          </div>
          {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90 disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Update password
            </button>
            <button type="button" onClick={() => { setOpen(false); setError(null); setCurrent(""); setNext(""); setConfirm(""); }} className="text-sm text-muted hover:text-ink">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
