"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Loader2, ExternalLink, Eye, EyeOff, Trash2, Plus, ChevronUp, ChevronDown, Search, Heart, User, ShoppingBag } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { cn } from "@/lib/utils/cn";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { ImageUpload } from "@/components/ui/image-upload";

type Config = Record<string, any>;

function Field({ label, value, onChange, textarea }: { label: string; value: string; onChange: (v: string) => void; textarea?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      {textarea ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm outline-none focus:border-accent" />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" />
      )}
    </label>
  );
}

interface LinkOption { group: string; label: string; value: string }

const PAGE_LINKS: LinkOption[] = [
  { group: "Pages", label: "Home", value: "/" },
  { group: "Pages", label: "Shop — all products", value: "/products" },
  { group: "Pages", label: "Offers", value: "/offers" },
  { group: "Pages", label: "About", value: "/about" },
  { group: "Pages", label: "Contact", value: "/contact" },
  { group: "Pages", label: "Journal", value: "/journal" },
  { group: "Pages", label: "Shipping", value: "/shipping" },
  { group: "Pages", label: "Returns", value: "/returns" },
  { group: "Pages", label: "Privacy", value: "/privacy" },
  { group: "Pages", label: "Terms", value: "/terms" },
  { group: "Pages", label: "Track order", value: "/track" },
  { group: "Pages", label: "Wishlist", value: "/wishlist" },
  { group: "Pages", label: "Cart", value: "/cart" },
];

function LinkPicker({ label, value, onChange, options }: { label?: string; value: string; onChange: (v: string) => void; options: LinkOption[] }) {
  const [forceCustom, setForceCustom] = useState(false);
  const known = options.some((o) => o.value === value);
  const isExternal = /^https?:\/\//i.test(value);
  const showCustom = forceCustom || isExternal;
  const groups = Array.from(new Set(options.map((o) => o.group)));

  const inner = showCustom ? (
    <div className="flex gap-2">
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" className="h-11 flex-1 rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" />
      <button type="button" onClick={() => { setForceCustom(false); if (isExternal) onChange(options[0]?.value ?? "/"); }} className="shrink-0 rounded-lg border border-line px-3 text-xs hover:bg-accent-soft">List</button>
    </div>
  ) : (
    <div className="relative">
      <select value={value} onChange={(e) => { if (e.target.value === "__custom__") { setForceCustom(true); return; } onChange(e.target.value); }} className="h-11 w-full appearance-none rounded-lg border border-line bg-canvas pl-3 pr-9 text-sm outline-none focus:border-accent">
        {!known && value && <option value={value}>{value}</option>}
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {options.filter((o) => o.group === g).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </optgroup>
        ))}
        <option value="__custom__">Custom / external URL…</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </div>
  );

  if (!label) return inner;
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      {inner}
    </label>
  );
}

function PreviewBar({ draft }: { draft: Config }) {
  const nav = (draft.nav ?? []) as { label: string; href: string }[];
  const announcements = (draft.announcements ?? []) as string[];
  const showAnn = draft.visibility?.announcement !== false && announcements.length > 0;
  return (
    <div className="mb-5">
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Live preview · storefront header</p>
      <div className="overflow-hidden rounded-2xl border border-line bg-canvas shadow-sm">
        {showAnn && <div className="truncate bg-ink px-4 py-1.5 text-center text-[11px] font-medium text-canvas">{announcements.join("   •   ")}</div>}
        <div className="flex items-center gap-4 px-4 py-3">
          <span className="font-display text-lg font-medium">{draft.brand?.name || "Brand"}</span>
          <nav className="hidden flex-1 items-center justify-center gap-5 text-[11px] font-semibold uppercase tracking-wide text-muted sm:flex">
            {nav.map((n, i) => <span key={i}>{n.label}</span>)}
          </nav>
          <div className="ml-auto flex items-center gap-2.5 text-muted sm:ml-0">
            <Search className="h-4 w-4" /><Heart className="h-4 w-4" /><User className="h-4 w-4" /><ShoppingBag className="h-4 w-4" />
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-muted">Updates as you edit Brand, Header Navigation and Announcement — Publish to push it live.</p>
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none",
        on ? "bg-accent" : "bg-black/15 dark:bg-white/20",
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200",
          on ? "translate-x-[22px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function SectionCard({ title, subtitle, on, onToggle, children }: { title: string; subtitle?: string; on?: boolean; onToggle?: () => void; children?: ReactNode }) {
  return (
    <section className="flex flex-col rounded-2xl border border-line bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg leading-tight">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {onToggle && (
          <div className="flex items-center gap-2">
            <span className={cn("flex items-center gap-1 text-xs font-medium", on ? "text-accent" : "text-muted")}>
              {on ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              {on ? "Visible" : "Hidden"}
            </span>
            <Toggle on={!!on} onChange={onToggle} />
          </div>
        )}
      </div>
      {children && <div className="space-y-4">{children}</div>}
    </section>
  );
}

export default function ConfigPage() {
  const { storeId, hasPermission } = useAdminAuth();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<Config | null>(null);
  const [products, setProducts] = useState<{ slug: string; title: string }[]>([]);
  const [linkOptions, setLinkOptions] = useState<LinkOption[]>(PAGE_LINKS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const q = storeId ? `?storeId=${storeId}` : "";
  const canEdit = hasPermission("config.update");
  const canPublish = hasPermission("config.publish");

  useEffect(() => {
    if (storeId === null) return;
    (async () => {
      const data = await api.get<{ draft: Config }>(`/site-config${q}`, { auth: true });
      setDraft(data.draft);
      setLoading(false);
    })();
    api.get<{ items: { slug: string; title: string }[] }>(`/products${q ? q + "&" : "?"}limit=100`, { auth: true })
      .then((r) => setProducts(r.items ?? []))
      .catch(() => setProducts([]));

    (async () => {
      try {
        const [cats, cols] = await Promise.all([
          api.get<{ name: string; slug: string; children?: unknown[] }[]>(`/categories${q}`, { auth: true }),
          api.get<{ items: { title: string; slug: string }[] }>(`/collections${q ? q + "&" : "?"}limit=100`, { auth: true }),
        ]);
        const flat: { name: string; slug: string }[] = [];
        const walk = (nodes: { name: string; slug: string; children?: unknown[] }[]) => nodes.forEach((n) => { flat.push({ name: n.name, slug: n.slug }); if (Array.isArray(n.children)) walk(n.children as typeof nodes); });
        walk(cats ?? []);
        setLinkOptions([
          ...PAGE_LINKS,
          ...flat.map((c) => ({ group: "Categories", label: c.name, value: `/collections/${c.slug}` })),
          ...(cols.items ?? []).map((c) => ({ group: "Collections", label: c.title, value: `/collections/${c.slug}` })),
        ]);
      } catch { /* keep page links only */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  function set(path: string[], value: unknown) {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      let node: any = next;
      for (let i = 0; i < path.length - 1; i++) node = node[path[i]] ??= {};
      node[path[path.length - 1]] = value;
      return next;
    });
    setStatus(null);
  }

  const visible = (key: string) => draft?.visibility?.[key] !== false;
  const toggle = (key: string) => set(["visibility", key], !visible(key));

  async function saveDraft() {
    if (!draft) return;
    setSaving(true);
    await api.put(`/site-config/draft${q}`, { draft }, { auth: true });
    setSaving(false);
    setStatus("Draft saved");
  }

  async function publish() {
    if (!draft) return;
    const ok = await confirm({
      title: "Publish to the storefront?",
      message: "Your changes will go live for all customers immediately.",
      confirmLabel: "Publish",
    });
    if (!ok) return;
    setPublishing(true);
    await api.put(`/site-config/draft${q}`, { draft }, { auth: true });
    await api.post(`/site-config/publish${q}`, {}, { auth: true });
    setPublishing(false);
    setStatus("Published — live on the storefront");
  }

  if (loading || !draft) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium">Site Config</h1>
          <p className="mt-1 text-sm text-muted">Edit each section and toggle whether customers see it. Publish to go live.</p>
        </div>
        <Link href="/" target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-widest text-accent">
          View storefront <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <PreviewBar draft={draft} />

      <div className={cn("grid gap-4 xl:grid-cols-2", !canEdit && "pointer-events-none opacity-70")}>
        <SectionCard title="Brand" subtitle="Shown in the header & footer — always visible">
          <Field label="Brand name" value={draft.brand?.name ?? ""} onChange={(v) => set(["brand", "name"], v)} />
          <Field label="Tagline" value={draft.brand?.tagline ?? ""} onChange={(v) => set(["brand", "tagline"], v)} textarea />
        </SectionCard>

        <SectionCard title="Header Navigation" subtitle="Top menu links — add, rename, reorder or remove">
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
              <span className="w-40 shrink-0">Label</span>
              <span className="flex-1">Links to</span>
              <span className="w-[104px] shrink-0" />
            </div>
            {(draft.nav ?? []).map((item: any, i: number) => {
              const setItem = (field: string, val: string) => set(["nav"], (draft.nav ?? []).map((x: any, j: number) => (j === i ? { ...x, [field]: val } : x)));
              const move = (dir: number) => { const arr = [...(draft.nav ?? [])]; const t = i + dir; if (t < 0 || t >= arr.length) return; [arr[i], arr[t]] = [arr[t], arr[i]]; set(["nav"], arr); };
              const btn = "flex h-11 w-8 shrink-0 items-center justify-center rounded-lg border border-line hover:bg-accent-soft disabled:opacity-40";
              return (
                <div key={i} className="flex items-center gap-2">
                  <input value={item.label ?? ""} onChange={(e) => setItem("label", e.target.value)} placeholder="Label" className="h-11 w-40 shrink-0 rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" />
                  <div className="flex-1"><LinkPicker value={item.href ?? ""} onChange={(v) => setItem("href", v)} options={linkOptions} /></div>
                  <button type="button" onClick={() => move(-1)} disabled={i === 0} className={btn} aria-label="Move up"><ChevronUp className="h-4 w-4" /></button>
                  <button type="button" onClick={() => move(1)} disabled={i === (draft.nav ?? []).length - 1} className={btn} aria-label="Move down"><ChevronDown className="h-4 w-4" /></button>
                  <button type="button" onClick={() => set(["nav"], (draft.nav ?? []).filter((_: any, j: number) => j !== i))} className={cn(btn, "text-danger hover:bg-danger/10")} aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                </div>
              );
            })}
            <button type="button" onClick={() => set(["nav"], [...(draft.nav ?? []), { label: "New link", href: "/products" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs hover:bg-accent-soft">
              <Plus className="h-3.5 w-3.5" /> Add link
            </button>
            <p className="text-xs text-muted">Pick a page, category or collection — links stay valid as the catalog changes. Use “Custom” only for external URLs.</p>
          </div>
        </SectionCard>

        <SectionCard title="Announcement Bar" subtitle="Top strip" on={visible("announcement")} onToggle={() => toggle("announcement")}>
          <Field label="Messages (one per line)" value={(draft.announcements ?? []).join("\n")} onChange={(v) => set(["announcements"], v.split("\n").map((s) => s.trim()).filter(Boolean))} textarea />
        </SectionCard>

        <SectionCard title="Hero" subtitle="Main banner" on={visible("hero")} onToggle={() => toggle("hero")}>
          <Field label="Small label above title" value={draft.hero?.eyebrow ?? ""} onChange={(v) => set(["hero", "eyebrow"], v)} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Title line" value={draft.hero?.titleLead ?? ""} onChange={(v) => set(["hero", "titleLead"], v)} />
            <Field label="Emphasis" value={draft.hero?.titleEmphasis ?? ""} onChange={(v) => set(["hero", "titleEmphasis"], v)} />
            <Field label="Title end" value={draft.hero?.titleTail ?? ""} onChange={(v) => set(["hero", "titleTail"], v)} />
          </div>
          <Field label="Subtitle" value={draft.hero?.subtitle ?? ""} onChange={(v) => set(["hero", "subtitle"], v)} textarea />
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">Featured product (hero card)</span>
            <div className="relative">
              <select value={draft.hero?.featuredProductSlug ?? ""} onChange={(e) => set(["hero", "featuredProductSlug"], e.target.value)} className="h-11 w-full appearance-none rounded-lg border border-line bg-canvas pl-3 pr-9 text-sm outline-none focus:border-accent">
                <option value="">None — show placeholder</option>
                {products.map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
            <span className="mt-1 block text-xs text-muted">Shown as the “Featured” card on the home hero.</span>
          </label>
        </SectionCard>

        <SectionCard title="Scrolling text strip" subtitle="Short phrases that scroll across the home page" on={visible("marquee")} onToggle={() => toggle("marquee")}>
          <Field label="Items (one per line)" value={(draft.marquee ?? []).join("\n")} onChange={(v) => set(["marquee"], v.split("\n").map((s) => s.trim()).filter(Boolean))} textarea />
        </SectionCard>

        <SectionCard title="Shipping & returns highlights" subtitle="Shipping / returns / support strip" on={visible("valueProps")} onToggle={() => toggle("valueProps")}>
          <p className="text-sm text-muted">{(draft.valueProps ?? []).length} highlights shown on the home page (Free shipping, Easy returns, etc.). Editing these is coming soon — toggle visibility above.</p>
        </SectionCard>

        <SectionCard title="Categories" subtitle="Shop-by-category grid" on={visible("categories")} onToggle={() => toggle("categories")}>
          <Field label="Small label above title" value={draft.sections?.categories?.eyebrow ?? ""} onChange={(v) => set(["sections", "categories", "eyebrow"], v)} />
          <Field label="Title" value={draft.sections?.categories?.title ?? ""} onChange={(v) => set(["sections", "categories", "title"], v)} />
        </SectionCard>

        <SectionCard title="Best Sellers" subtitle="Product rail" on={visible("bestSellers")} onToggle={() => toggle("bestSellers")}>
          <Field label="Small label above title" value={draft.sections?.bestSellers?.eyebrow ?? ""} onChange={(v) => set(["sections", "bestSellers", "eyebrow"], v)} />
          <Field label="Title" value={draft.sections?.bestSellers?.title ?? ""} onChange={(v) => set(["sections", "bestSellers", "title"], v)} />
          <Field label="Description" value={draft.sections?.bestSellers?.description ?? ""} onChange={(v) => set(["sections", "bestSellers", "description"], v)} textarea />
        </SectionCard>

        <SectionCard title="Promo Banners" subtitle="Campaign banners" on={visible("promos")} onToggle={() => toggle("promos")}>
          <div className="space-y-3">
            {(draft.promos ?? []).map((p: any, i: number) => {
              const setPromo = (field: string, val: string) => set(["promos"], (draft.promos ?? []).map((x: any, j: number) => (j === i ? { ...x, [field]: val } : x)));
              return (
                <div key={i} className="rounded-xl border border-line p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted">Banner {i + 1}</span>
                    <button type="button" onClick={() => set(["promos"], (draft.promos ?? []).filter((_: any, j: number) => j !== i))} className="rounded-lg p-1 text-danger hover:bg-danger/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Small label above title" value={p.subtitle ?? ""} onChange={(v) => setPromo("subtitle", v)} />
                    <Field label="Title" value={p.title ?? ""} onChange={(v) => setPromo("title", v)} />
                    <Field label="Button label" value={p.cta ?? ""} onChange={(v) => setPromo("cta", v)} />
                    <LinkPicker label="Link" value={p.href ?? ""} onChange={(v) => setPromo("href", v)} options={linkOptions} />
                  </div>
                  <div className="mt-3">
                    <ImageUpload label="Banner image" value={p.image ?? ""} folder="banners" onChange={(url) => setPromo("image", url)} hint="Recommended 1600 × 900px (16:9) · JPG or PNG · under 5 MB" />
                  </div>
                </div>
              );
            })}
            <button type="button" onClick={() => set(["promos"], [...(draft.promos ?? []), { title: "", subtitle: "", cta: "Shop now", href: "/products", image: "" }])} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs hover:bg-accent-soft">
              <Plus className="h-3.5 w-3.5" /> Add banner
            </button>
          </div>
        </SectionCard>

        <SectionCard title="New Arrivals" subtitle="Product rail" on={visible("newArrivals")} onToggle={() => toggle("newArrivals")}>
          <Field label="Small label above title" value={draft.sections?.newArrivals?.eyebrow ?? ""} onChange={(v) => set(["sections", "newArrivals", "eyebrow"], v)} />
          <Field label="Title" value={draft.sections?.newArrivals?.title ?? ""} onChange={(v) => set(["sections", "newArrivals", "title"], v)} />
          <Field label="Description" value={draft.sections?.newArrivals?.description ?? ""} onChange={(v) => set(["sections", "newArrivals", "description"], v)} textarea />
        </SectionCard>

        <SectionCard title="Offers & Coupons" subtitle="Coupon strip" on={visible("offers")} onToggle={() => toggle("offers")}>
          <Field label="Small label above title" value={draft.sections?.offers?.eyebrow ?? ""} onChange={(v) => set(["sections", "offers", "eyebrow"], v)} />
          <Field label="Title" value={draft.sections?.offers?.title ?? ""} onChange={(v) => set(["sections", "offers", "title"], v)} />
          <Field label="Description" value={draft.sections?.offers?.description ?? ""} onChange={(v) => set(["sections", "offers", "description"], v)} textarea />
        </SectionCard>

        <SectionCard title="Testimonials" subtitle="Customer reviews" on={visible("testimonials")} onToggle={() => toggle("testimonials")}>
          <Field label="Small label above title" value={draft.sections?.testimonials?.eyebrow ?? ""} onChange={(v) => set(["sections", "testimonials", "eyebrow"], v)} />
          <Field label="Title" value={draft.sections?.testimonials?.title ?? ""} onChange={(v) => set(["sections", "testimonials", "title"], v)} />
        </SectionCard>

        <SectionCard title="Newsletter" subtitle="Email signup band" on={visible("newsletter")} onToggle={() => toggle("newsletter")}>
          <Field label="Small label above title" value={draft.newsletter?.eyebrow ?? ""} onChange={(v) => set(["newsletter", "eyebrow"], v)} />
          <Field label="Title" value={draft.newsletter?.title ?? ""} onChange={(v) => set(["newsletter", "title"], v)} />
          <Field label="Subtitle" value={draft.newsletter?.subtitle ?? ""} onChange={(v) => set(["newsletter", "subtitle"], v)} textarea />
          <Field label="Button label" value={draft.newsletter?.cta ?? ""} onChange={(v) => set(["newsletter", "cta"], v)} />
        </SectionCard>

        <SectionCard title="Footer" subtitle="Link columns shown at the bottom of every page">
          <div className="space-y-4">
            {(draft.footer?.groups ?? []).map((g: any, gi: number) => {
              const setGroup = (fn: (x: any) => any) => set(["footer", "groups"], (draft.footer?.groups ?? []).map((x: any, j: number) => (j === gi ? fn(x) : x)));
              return (
                <div key={gi} className="rounded-xl border border-line p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <input value={g.title ?? ""} onChange={(e) => setGroup((x) => ({ ...x, title: e.target.value }))} placeholder="Column title" className="h-11 flex-1 rounded-lg border border-line bg-canvas px-3 text-sm font-medium outline-none focus:border-accent" />
                    <button type="button" onClick={() => set(["footer", "groups"], (draft.footer?.groups ?? []).filter((_: any, j: number) => j !== gi))} className="flex h-11 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-danger hover:bg-danger/10" aria-label="Remove column"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  <div className="space-y-2">
                    {(g.links ?? []).map((l: any, li: number) => (
                      <div key={li} className="flex items-center gap-2">
                        <input value={l.label ?? ""} onChange={(e) => setGroup((x) => ({ ...x, links: x.links.map((y: any, k: number) => (k === li ? { ...y, label: e.target.value } : y)) }))} placeholder="Label" className="h-11 w-40 shrink-0 rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" />
                        <div className="flex-1"><LinkPicker value={l.href ?? ""} onChange={(v) => setGroup((x) => ({ ...x, links: x.links.map((y: any, k: number) => (k === li ? { ...y, href: v } : y)) }))} options={linkOptions} /></div>
                        <button type="button" onClick={() => setGroup((x) => ({ ...x, links: x.links.filter((_: any, k: number) => k !== li) }))} className="flex h-11 w-8 shrink-0 items-center justify-center rounded-lg border border-line text-danger hover:bg-danger/10" aria-label="Remove link"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setGroup((x) => ({ ...x, links: [...(x.links ?? []), { label: "", href: "/" }] }))} className="text-xs font-medium text-accent hover:underline">+ Add link</button>
                  </div>
                </div>
              );
            })}
            <button type="button" onClick={() => set(["footer", "groups"], [...(draft.footer?.groups ?? []), { title: "New column", links: [] }])} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs hover:bg-accent-soft">
              <Plus className="h-3.5 w-3.5" /> Add column
            </button>
            <Field label="Footer note" value={draft.footer?.note ?? ""} onChange={(v) => set(["footer", "note"], v)} />
          </div>
        </SectionCard>
      </div>

      {canEdit && (
        <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-end gap-3">
          <span className="mr-auto text-xs text-muted">Changes save privately as a draft — Publish to make them live on your storefront.</span>
          {status && <span className="text-sm text-accent">{status}</span>}
          <button onClick={saveDraft} disabled={saving} className="flex items-center gap-2 rounded-full border border-ink/20 px-5 py-3 text-xs font-semibold uppercase tracking-widest hover:bg-accent-soft disabled:opacity-50">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save draft
          </button>
          {canPublish && (
            <button onClick={publish} disabled={publishing} className="flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-xs font-semibold uppercase tracking-widest text-accent-foreground hover:opacity-90 disabled:opacity-50">
              {publishing && <Loader2 className="h-4 w-4 animate-spin" />} Publish
            </button>
          )}
        </div>
      )}
    </div>
  );
}
