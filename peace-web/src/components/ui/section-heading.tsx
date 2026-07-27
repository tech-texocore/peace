import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { type as t } from "@/lib/tokens";

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  align?: "left" | "center";
  placeholder?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  ctaLabel,
  ctaHref,
  align = "left",
  placeholder,
}: SectionHeadingProps) {
  const centered = align === "center";
  return (
    <div
      className={cn(
        "mb-7 sm:mb-10",
        centered
          ? "flex flex-col items-center text-center"
          : "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
      )}
    >
      <div className="max-w-2xl">
        {eyebrow && (
          <p className={cn("mb-3 inline-flex items-center gap-2", t.eyebrow)}>
            <span className="h-px w-6 bg-accent" />
            {eyebrow}
          </p>
        )}
        <h2 className={t.h2}>
          {title}
          {placeholder && (
            <span title={placeholder} className="ml-2 inline-block translate-y-[-4px] rounded-full border border-dashed border-muted/50 px-2 py-0.5 align-middle text-[10px] font-medium uppercase tracking-wide text-muted/70">
              Placeholder
            </span>
          )}
        </h2>
        {description && (
          <p className={cn("mt-3 max-w-md", t.muted, "sm:text-base")}>{description}</p>
        )}
      </div>

      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className={cn("group inline-flex items-center gap-2 text-ink", t.label)}
        >
          {ctaLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </Link>
      )}
    </div>
  );
}
