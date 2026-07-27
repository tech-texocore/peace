"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { FilterSidebar } from "./filter-sidebar";
import type { ProductFacets } from "@/lib/storefront-server";

export function MobileFilters({ facets }: { facets: ProductFacets }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button onClick={() => setOpen(true)} className="flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm">
        <SlidersHorizontal className="h-4 w-4" /> Filters
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
          <div className="w-[82vw] max-w-sm overflow-y-auto bg-canvas p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-lg">Filters</span>
              <button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <FilterSidebar facets={facets} />
            <button onClick={() => setOpen(false)} className="mt-6 h-11 w-full rounded-full bg-accent text-sm font-medium text-accent-foreground">Show results</button>
          </div>
        </div>
      )}
    </div>
  );
}
