"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export interface LightboxMedia { url: string; type?: string }

export function Lightbox({ media, start = 0, onClose }: { media: LightboxMedia[]; start?: number; onClose: () => void }) {
  const [i, setI] = useState(start);
  const go = (d: number) => setI((p) => (p + d + media.length) % media.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [media.length]);

  const m = media[i];
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/90">
      <div className="flex items-center justify-between p-4 text-white/80">
        <span className="text-sm">{i + 1} / {media.length}</span>
        <button onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-white/10"><X className="h-6 w-6" /></button>
      </div>
      <div className="relative flex flex-1 items-center justify-center px-4 pb-6">
        {media.length > 1 && (
          <button onClick={() => go(-1)} className="absolute left-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><ChevronLeft className="h-6 w-6" /></button>
        )}
        {m.type === "VIDEO" ? (
          <video src={m.url} controls autoPlay className="max-h-full max-w-full rounded-lg" />
        ) : (
          <img src={m.url} alt="" className="max-h-full max-w-full rounded-lg object-contain" />
        )}
        {media.length > 1 && (
          <button onClick={() => go(1)} className="absolute right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"><ChevronRight className="h-6 w-6" /></button>
        )}
      </div>
      {media.length > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto p-4">
          {media.map((mm, idx) => (
            <button key={idx} onClick={() => setI(idx)} className={`h-14 w-12 shrink-0 overflow-hidden rounded border-2 ${idx === i ? "border-white" : "border-transparent opacity-60"}`}>
              {mm.type === "VIDEO" ? <video src={mm.url} className="h-full w-full object-cover" /> : <img src={mm.url} alt="" className="h-full w-full object-cover" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
