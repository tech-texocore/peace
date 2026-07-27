import { cn } from "@/lib/utils/cn";
import { ImageIcon } from "lucide-react";

export function Placeholder({
  className,
  label,
  ratio = "aspect-square",
}: {
  className?: string;
  label?: string;
  ratio?: string;
}) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden bg-accent-soft",
        ratio,
        className,
      )}
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent, transparent 14px, color-mix(in oklab, var(--ink) 6%, transparent) 14px, color-mix(in oklab, var(--ink) 6%, transparent) 15px)",
        }}
      />
      <div className="relative flex flex-col items-center gap-2 text-muted">
        <ImageIcon className="h-6 w-6" />
        {label && <span className="text-xs font-medium tracking-wide">{label}</span>}
      </div>
    </div>
  );
}
