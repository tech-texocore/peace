"use client";

import { useState, type ReactNode } from "react";
import { Loader2, Lock, ChevronDown } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";

export const inputCls = "h-11 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent";

export function Label({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">
      {children}{required && <span className="text-danger"> *</span>}
    </span>
  );
}

export function Field({ label, value, onChange, required, textarea, ...rest }: { label: string; value: string; onChange: (v: string) => void; required?: boolean; textarea?: boolean } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value">) {
  return (
    <label className="block">
      <Label required={required}>{label}</Label>
      {textarea ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, "h-auto py-2")} />
      ) : (
        <input required={required} value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} {...rest} />
      )}
    </label>
  );
}

export function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <div className="relative">
        <input readOnly value={value} placeholder="—" className={cn(inputCls, "bg-accent-soft/40 pr-9 text-muted")} />
        <Lock className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted/60" />
      </div>
    </label>
  );
}

export function SelectField({ label, required, value, onChange, children }: { label: string; required?: boolean; value: string; onChange: (v: string) => void; children: ReactNode }) {
  return (
    <label className="block">
      <Label required={required}>{label}</Label>
      <div className="relative">
        <select required={required} value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, "appearance-none pr-9")}>
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
      </div>
    </label>
  );
}

export interface AddressValue {
  line1?: string;
  line2?: string;
  landmark?: string;
  postalCode?: string;
  city?: string;
  district?: string;
  state?: string;
}

// PIN-code-driven address fields — reused by the customer address book and store settings.
export function AddressFields({ value, onChange, requireLine1 = true }: { value: AddressValue; onChange: (patch: Partial<AddressValue>) => void; requireLine1?: boolean }) {
  const [localities, setLocalities] = useState<string[]>(value.city ? [value.city] : []);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  async function lookupPin(pin: string) {
    onChange({ postalCode: pin });
    if (!/^\d{6}$/.test(pin)) { setLocalities([]); return; }
    setPinBusy(true);
    setPinError(null);
    try {
      const geo = await api.get<{ state: string; district: string; localities: string[] }>(`/geo/pincode/${pin}`);
      onChange({ state: geo.state, district: geo.district, city: geo.localities.length === 1 ? geo.localities[0] : "" });
      setLocalities(geo.localities);
    } catch {
      setPinError("Couldn't find that PIN code");
      onChange({ state: "", district: "", city: "" });
      setLocalities([]);
    } finally {
      setPinBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Field label="Flat / House no. / Building, Street" required={requireLine1} placeholder="e.g. 12, Weavers Street, T. Nagar" value={value.line1 ?? ""} onChange={(v) => onChange({ line1: v })} />
      <Field label="Area / Colony" placeholder="e.g. West Mambalam" value={value.line2 ?? ""} onChange={(v) => onChange({ line2: v })} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <Label required>PIN code</Label>
          <input required inputMode="numeric" maxLength={6} placeholder="e.g. 600001" value={value.postalCode ?? ""} onChange={(e) => lookupPin(e.target.value.replace(/\D/g, ""))} className={inputCls} />
          {pinBusy && <p className="mt-1 flex items-center gap-1 text-xs text-muted"><Loader2 className="h-3 w-3 animate-spin" /> Looking up…</p>}
          {pinError && <p className="mt-1 text-xs text-danger">{pinError}</p>}
        </label>
        {localities.length > 1 ? (
          <SelectField label="City / Area" required value={value.city ?? ""} onChange={(v) => onChange({ city: v })}>
            <option value="" disabled>Select your area…</option>
            {localities.map((l) => <option key={l} value={l}>{l}</option>)}
          </SelectField>
        ) : (
          <label className="block">
            <Label required>City / Area</Label>
            <input readOnly value={value.city ?? ""} placeholder="Auto from PIN" className={cn(inputCls, "bg-accent-soft/40 text-muted")} />
          </label>
        )}
        <ReadOnlyField label="District" value={value.district ?? ""} />
        <ReadOnlyField label="State" value={value.state ?? ""} />
      </div>

      <Field label="Landmark" placeholder="e.g. Near Apollo Hospital" value={value.landmark ?? ""} onChange={(v) => onChange({ landmark: v })} />
    </div>
  );
}
