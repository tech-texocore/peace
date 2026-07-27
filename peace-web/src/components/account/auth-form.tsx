"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { Container } from "@/components/layout/container";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export function AuthForm() {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, resetPassword } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSignup = mode === "signup";
  const isReset = mode === "reset";

  function go(next: "signin" | "signup" | "reset") { setMode(next); setError(null); setNotice(null); }

  function friendlyError(raw: string) {
    const m = raw.replace("Firebase:", "").trim();
    if (m.includes("invalid-credential") || m.includes("wrong-password") || m.includes("user-not-found"))
      return "Incorrect email or password.";
    if (m.includes("email-already-in-use")) return "An account with this email already exists. Try signing in.";
    if (m.includes("weak-password")) return "Password is too weak — use at least 6 characters.";
    if (m.includes("invalid-email")) return "Please enter a valid email address.";
    if (m.includes("too-many-requests")) return "Too many attempts. Please try again in a moment.";
    return m || "Something went wrong. Please try again.";
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setNotice(null);
    if (isReset) {
      setBusy(true);
      try {
        await resetPassword(email);
        setNotice(`If an account exists for ${email}, we've sent a password reset link. Check your inbox.`);
      } catch (err) {
        setError(friendlyError((err as Error).message));
      } finally { setBusy(false); }
      return;
    }
    if (isSignup && password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      if (isSignup) await signUpWithEmail(name, email, password);
      else await signInWithEmail(email, password);
    } catch (err) {
      setError(friendlyError((err as Error).message));
      setBusy(false);
    }
  }

  async function google() {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(friendlyError((err as Error).message));
    }
  }

  return (
    <Container className="flex min-h-[70vh] items-center justify-center py-12">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl font-medium">
            {isSignup ? "Create your account" : isReset ? "Reset your password" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted">
            {isSignup
              ? "Sign up to save your cart, wishlist and orders."
              : isReset
                ? "Enter your email and we'll send you a link to reset it."
                : "Sign in to continue to checkout."}
          </p>
        </div>

        {!isReset && (
          <>
            <button
              onClick={google}
              className="mb-5 flex h-12 w-full items-center justify-center gap-3 rounded-full border border-line bg-card text-sm font-medium transition-colors hover:bg-accent-soft"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="mb-5 flex items-center gap-3 text-xs uppercase tracking-widest text-muted">
              <span className="h-px flex-1 bg-line" /> or use email <span className="h-px flex-1 bg-line" />
            </div>
          </>
        )}

        <form onSubmit={submit} className="space-y-3">
          {isSignup && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Full name</span>
              <input required placeholder="e.g. Ranjith Kumar" value={name} onChange={(e) => setName(e.target.value)} className="h-12 w-full rounded-full border border-line bg-card px-5 text-sm outline-none focus:border-accent" />
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Email</span>
            <input required type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 w-full rounded-full border border-line bg-card px-5 text-sm outline-none focus:border-accent" />
          </label>
          {!isReset && (
            <label className="block">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Password</span>
                {!isSignup && <button type="button" onClick={() => go("reset")} className="text-xs font-medium text-accent hover:underline">Forgot password?</button>}
              </div>
              <input required type="password" placeholder={isSignup ? "At least 6 characters" : "Your password"} value={password} onChange={(e) => setPassword(e.target.value)} className="h-12 w-full rounded-full border border-line bg-card px-5 text-sm outline-none focus:border-accent" />
            </label>
          )}

          {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
          {notice && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{notice}</p>}

          <button type="submit" disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-sm font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90 disabled:opacity-50">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSignup ? "Create account" : isReset ? "Send reset link" : "Sign in"}
          </button>
        </form>

        {isReset ? (
          <p className="mt-5 text-center text-sm text-muted">
            Remembered it?{" "}
            <button onClick={() => go("signin")} className="font-semibold text-ink underline underline-offset-2">Back to sign in</button>
          </p>
        ) : (
          <p className="mt-5 text-center text-sm text-muted">
            {isSignup ? "Already have an account?" : "New to Peace?"}{" "}
            <button
              onClick={() => go(isSignup ? "signin" : "signup")}
              className="font-semibold text-ink underline underline-offset-2"
            >
              {isSignup ? "Sign in" : "Create account"}
            </button>
          </p>
        )}

        <p className="mt-6 text-center text-xs text-muted">
          You can browse freely — an account is only needed to check out.
        </p>
      </div>
    </Container>
  );
}
