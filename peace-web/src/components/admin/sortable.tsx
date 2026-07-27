"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type SortState = { key: string; dir: "asc" | "desc" } | null;

export function useSort(initial: SortState = null) {
  const [sort, setSort] = useState<SortState>(initial);
  const toggle = (key: string) => setSort((s) => (s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));

  function apply<T>(rows: T[], accessors: Record<string, (r: T) => string | number | null | undefined>): T[] {
    if (!sort) return rows;
    const get = accessors[sort.key];
    if (!get) return rows;
    const d = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = get(a), bv = get(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * d;
      return String(av ?? "").localeCompare(String(bv ?? "")) * d;
    });
  }

  return { sort, toggle, apply };
}

export function SortTh({ label, sortKey, sort, onSort, align, className }: {
  label: string; sortKey: string; sort: SortState; onSort: (k: string) => void; align?: "right" | "center"; className?: string;
}) {
  const active = sort?.key === sortKey;
  const Icon = active ? (sort!.dir === "asc" ? ChevronUp : ChevronDown) : ChevronsUpDown;
  return (
    <th className={cn("px-4 py-3", className)}>
      <button type="button" onClick={() => onSort(sortKey)} className={cn("inline-flex select-none items-center gap-1 hover:text-ink", align === "right" && "flex-row-reverse", active && "text-ink")}>
        {label}
        <Icon className={cn("h-3 w-3", active ? "text-accent" : "text-muted/40")} />
      </button>
    </th>
  );
}
