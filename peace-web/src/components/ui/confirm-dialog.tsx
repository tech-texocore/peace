"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface State extends ConfirmOptions {
  resolve: (v: boolean) => void;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = useCallback<ConfirmFn>(
    (opts) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    [],
  );

  function close(result: boolean) {
    state?.resolve(result);
    setState(null);
    setBusy(false);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => close(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-line bg-card p-6 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", state.danger ? "bg-danger/10 text-danger" : "bg-accent-soft text-accent")}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-lg leading-tight">{state.title}</h3>
                {state.message && <p className="mt-1 text-sm text-muted">{state.message}</p>}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => close(false)} className="rounded-full border border-line px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted hover:text-ink">
                {state.cancelLabel ?? "Cancel"}
              </button>
              <button
                onClick={() => { setBusy(true); close(true); }}
                className={cn(
                  "flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold uppercase tracking-widest text-white hover:opacity-90",
                  state.danger ? "bg-danger" : "bg-accent text-accent-foreground",
                )}
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {state.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
