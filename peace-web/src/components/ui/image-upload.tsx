"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, X, ImageIcon } from "lucide-react";
import { api } from "@/lib/api/client";
import { Label } from "@/components/ui/form-fields";
import { cn } from "@/lib/utils/cn";

interface Props {
  label?: string;
  value?: string;
  onChange: (url: string) => void;
  folder?: string;
  className?: string;
  hint?: string;
}

// Reusable single-image uploader — posts to /media/upload and returns a URL.
export function ImageUpload({ label, value, onChange, folder = "misc", className, hint }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file");
    if (file.size > 5 * 1024 * 1024) return setError("Image must be under 5 MB");
    setError(null);
    setBusy(true);
    try {
      const res = await api.upload<{ url: string }>(`/media/upload?folder=${folder}`, file, { auth: true });
      onChange(res.url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("block", className)}>
      {label && <Label>{label}</Label>}
      <div className="flex items-center gap-3">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-canvas">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageIcon className="h-6 w-6 text-muted/50" />
          )}
          {busy && <div className="absolute inset-0 flex items-center justify-center bg-canvas/70"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>}
        </div>
        <div className="flex flex-col gap-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="inline-flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm hover:bg-accent-soft disabled:opacity-50">
            <Upload className="h-4 w-4" /> {value ? "Replace" : "Upload"}
          </button>
          {value && (
            <button type="button" onClick={() => onChange("")} className="inline-flex items-center gap-1 text-xs text-danger hover:underline">
              <X className="h-3.5 w-3.5" /> Remove
            </button>
          )}
        </div>
      </div>
      {hint && !error && <p className="mt-2 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1.5 text-xs text-danger">{error}</p>}
    </div>
  );
}
