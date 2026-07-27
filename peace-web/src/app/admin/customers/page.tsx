"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, X, Users, ChevronDown, MapPin } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { PageHeader } from "@/components/admin/page-header";
import { SubNav, CUSTOMER_TABS } from "@/components/admin/sub-nav";
import { EmptyState } from "@/components/admin/empty-state";
import { useSort, SortTh } from "@/components/admin/sortable";
import { inr, ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/orders";

interface Group { id: string; name: string }
interface Customer { id: string; name: string | null; email: string; phone: string | null; createdAt: string; customerGroup: Group | null; location: string | null; orders: number; spent: number }

const joined = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
interface DetailResp {
  id: string; name: string | null; email: string; phone: string | null; customerGroup: Group | null;
  addresses: { id: string; line1: string; city: string; state: string; postalCode: string }[];
  orders: { id: string; orderNumber: string; total: number; status: string; createdAt: string }[];
  stats: { orders: number; spent: number };
}

export default function CustomersPage() {
  const { storeId, hasPermission } = useAdminAuth();
  const [rows, setRows] = useState<Customer[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<DetailResp | null>(null);
  const [busy, setBusy] = useState(false);

  const q = storeId ? `storeId=${storeId}` : "";
  const canEdit = hasPermission("customers.update");
  const { sort, toggle, apply } = useSort();
  const hasFilters = !!(search || stateFilter || groupFilter);

  const load = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const p = new URLSearchParams(q);
    if (search) p.set("search", search);
    if (stateFilter) p.set("state", stateFilter);
    if (groupFilter) p.set("groupId", groupFilter);
    const res = await api.get<{ items: Customer[]; facets?: { states: string[] } }>(`/customers?${p}`, { auth: true });
    setRows(res.items);
    if (res.facets?.states) setStates(res.facets.states);
    setLoading(false);
  }, [storeId, q, search, stateFilter, groupFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (storeId) api.get<{ items: Group[] }>(`/customer-groups?${q}`, { auth: true }).then((r) => setGroups(r.items)).catch(() => {}); }, [storeId, q]);

  async function open(id: string) { setDetail(await api.get<DetailResp>(`/customers/${id}?${q}`, { auth: true })); }
  async function assign(groupId: string) {
    if (!detail) return;
    setBusy(true);
    try { await api.patch(`/customers/${detail.id}/group?${q}`, { customerGroupId: groupId || null }, { auth: true }); await open(detail.id); await load(); }
    finally { setBusy(false); }
  }

  const shown = apply(rows, { customer: (c) => c.name ?? c.email, place: (c) => c.location ?? "", group: (c) => c.customerGroup?.name ?? "", orders: (c) => c.orders, spent: (c) => c.spent, joined: (c) => c.createdAt });

  return (
    <div className="w-full">
      <PageHeader
        title="Customers"
        description="Everyone who's bought from your store — see their spend, location, order history, and assign them to a pricing group."
      />
      <SubNav tabs={CUSTOMER_TABS} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name / email / phone" className="h-9 w-64 rounded-full border border-line bg-canvas pl-9 pr-3 text-sm outline-none focus:border-accent" />
        </div>
        <div className="relative">
          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="h-9 appearance-none rounded-full border border-line bg-card pl-4 pr-9 text-sm outline-none focus:border-accent">
            <option value="">All locations</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        </div>
        <div className="relative">
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="h-9 appearance-none rounded-full border border-line bg-card pl-4 pr-9 text-sm outline-none focus:border-accent">
            <option value="">All groups</option>
            <option value="none">No group (retail)</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        </div>
        {hasFilters && <button onClick={() => { setSearch(""); setStateFilter(""); setGroupFilter(""); }} className="rounded-full border border-line px-3 py-1.5 text-xs text-muted hover:bg-accent-soft">Clear</button>}
        {!loading && <span className="ml-auto text-sm text-muted">{shown.length} customer{shown.length === 1 ? "" : "s"}</span>}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>
      ) : !shown.length ? (
        <EmptyState icon={Users} title={hasFilters ? "No matching customers" : "No customers yet"} description={hasFilters ? "Try a different search, location, or group." : "Customers appear here automatically once someone places their first order."} />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="bg-accent-soft/40 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <SortTh label="Customer" sortKey="customer" sort={sort} onSort={toggle} className="px-4 py-3" />
                <SortTh label="Location" sortKey="place" sort={sort} onSort={toggle} className="px-4 py-3" />
                <SortTh label="Group" sortKey="group" sort={sort} onSort={toggle} className="px-4 py-3" />
                <SortTh label="Orders" sortKey="orders" sort={sort} onSort={toggle} align="right" className="px-4 py-3" />
                <SortTh label="Spent" sortKey="spent" sort={sort} onSort={toggle} align="right" className="px-4 py-3" />
                <SortTh label="Joined" sortKey="joined" sort={sort} onSort={toggle} className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id} onClick={() => open(c.id)} className="cursor-pointer border-t border-line hover:bg-accent-soft/30">
                  <td className="px-4 py-3"><span className="font-medium">{c.name ?? "—"}</span><span className="block text-xs text-muted">{c.email}{c.phone ? ` · ${c.phone}` : ""}</span></td>
                  <td className="px-4 py-3 text-muted">{c.location ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{c.location}</span> : "—"}</td>
                  <td className="px-4 py-3">{c.customerGroup ? <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">{c.customerGroup.name}</span> : <span className="text-muted">—</span>}</td>
                  <td className="px-4 py-3 text-right">{c.orders}</td>
                  <td className="px-4 py-3 text-right font-medium">{inr(c.spent)}</td>
                  <td className="px-4 py-3 text-muted">{joined(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setDetail(null)}>
          <div className="h-full w-full max-w-xl overflow-y-auto bg-canvas p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <div><h2 className="font-display text-lg">{detail.name ?? "Customer"}</h2><p className="text-xs text-muted">{detail.email}{detail.phone ? ` · ${detail.phone}` : ""}</p></div>
              <button onClick={() => setDetail(null)}><X className="h-5 w-5" /></button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-line p-3"><p className="text-xs text-muted">Orders</p><p className="font-display text-xl">{detail.stats.orders}</p></div>
              <div className="rounded-xl border border-line p-3"><p className="text-xs text-muted">Total spent</p><p className="font-display text-xl">{inr(detail.stats.spent)}</p></div>
            </div>

            <div className="mb-4 rounded-xl border border-line p-3">
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Customer group</p>
              {canEdit ? (
                <select value={detail.customerGroup?.id ?? ""} onChange={(e) => assign(e.target.value)} disabled={busy} className="h-10 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent">
                  <option value="">No group (retail)</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              ) : <p className="text-sm">{detail.customerGroup?.name ?? "No group"}</p>}
            </div>

            {detail.addresses.length > 0 && (
              <div className="mb-4">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">Addresses</p>
                {detail.addresses.map((a) => <p key={a.id} className="text-sm text-muted">{a.line1}, {a.city}, {a.state} — {a.postalCode}</p>)}
              </div>
            )}

            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Recent orders</p>
            {detail.orders.length === 0 ? <p className="text-sm text-muted">No orders yet.</p> : (
              <div className="divide-y divide-line rounded-xl border border-line">
                {detail.orders.map((o) => (
                  <div key={o.id} className="flex items-center justify-between p-3 text-sm">
                    <span className="font-medium">{o.orderNumber}</span>
                    <span className="text-xs text-muted">{new Date(o.createdAt).toLocaleDateString("en-IN")}</span>
                    <span>{inr(o.total)}</span>
                    <span className="text-xs text-muted">{ORDER_STATUS_LABEL[o.status as OrderStatus] ?? o.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
