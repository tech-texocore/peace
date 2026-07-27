"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ChevronLeft, ChevronRight, Search, ClipboardList } from "lucide-react";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils/cn";
import { EmptyState } from "@/components/admin/empty-state";

interface AuditRow {
  id: string;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  method: string;
  path: string;
  status: number;
  createdAt: string;
}

const methodColor: Record<string, string> = {
  POST: "text-accent",
  PUT: "text-accent",
  PATCH: "text-accent",
  DELETE: "text-danger",
};

const VERB_LABEL: Record<string, string> = {
  create: "Added",
  update: "Updated",
  delete: "Deleted",
  publish: "Published",
  moderate: "Moderated",
};

function titleCase(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function singularise(s: string) {
  if (s.endsWith("ies")) return s.slice(0, -3) + "y";
  if (s.endsWith("s")) return s.slice(0, -1);
  return s;
}

function actionLabel(action: string) {
  const dot = action.indexOf(".");
  const entity = dot >= 0 ? action.slice(0, dot) : "";
  const verb = dot >= 0 ? action.slice(dot + 1) : action;
  const verbLabel = VERB_LABEL[verb] ?? titleCase(verb);
  const entityLabel = entity ? titleCase(singularise(entity)) : "";
  return entityLabel ? `${verbLabel} ${entityLabel}` : verbLabel;
}

export default function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [loading, setLoading] = useState(true);
  const limit = 20;

  const load = useCallback(async (p: number) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p), limit: String(limit) });
    if (action) params.set("action", action);
    if (actor) params.set("actorEmail", actor);
    const res = await api.get<{ items: AuditRow[]; total: number }>(`/audit?${params}`, { auth: true });
    setRows(res.items);
    setTotal(res.total);
    setLoading(false);
  }, [action, actor]);

  useEffect(() => { load(page); }, [page, load]);

  const pages = Math.max(1, Math.ceil(total / limit));

  function fmt(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium">Audit Log</h1>
          <p className="text-sm text-muted">A record of every change made in the admin — who did what, and when.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} placeholder="Filter action…" className="h-10 rounded-full border border-line bg-card pl-9 pr-4 text-sm outline-none focus:border-accent" />
          </div>
          <input value={actor} onChange={(e) => { setActor(e.target.value); setPage(1); }} placeholder="Filter actor…" className="h-10 rounded-full border border-line bg-card px-4 text-sm outline-none focus:border-accent" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-3 font-semibold">When</th>
              <th className="px-5 py-3 font-semibold">Actor</th>
              <th className="px-5 py-3 font-semibold">Action</th>
              <th className="px-5 py-3 font-semibold">Request</th>
              <th className="px-5 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="py-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-muted" /></td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={5} className="p-4"><EmptyState icon={ClipboardList} title="No activity yet" description="Changes made in the admin will show up here as they happen." /></td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-5 py-3 text-muted">{fmt(r.createdAt)}</td>
                  <td className="px-5 py-3">
                    <span className="block font-medium">{r.actorEmail ?? "—"}</span>
                    <span className="text-xs text-muted">{r.actorRole?.replace("_", " ")}</span>
                  </td>
                  <td className="px-5 py-3"><span className="font-medium">{actionLabel(r.action)}</span></td>
                  <td className="px-5 py-3">
                    <span className={cn("font-mono text-xs font-semibold", methodColor[r.method] ?? "text-ink")}>{r.method}</span>
                    <span className="ml-2 font-mono text-xs text-muted">{r.path}</span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", r.status >= 200 && r.status < 300 ? "bg-accent-soft text-accent" : "bg-danger/10 text-danger")}>{r.status >= 200 && r.status < 300 ? "Success" : "Failed"}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-muted">
        <span>{total} entries</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-line p-2 disabled:opacity-40 hover:bg-accent-soft"><ChevronLeft className="h-4 w-4" /></button>
          <span>Page {page} / {pages}</span>
          <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page >= pages} className="rounded-lg border border-line p-2 disabled:opacity-40 hover:bg-accent-soft"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
