"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ChevronDown, ChevronRight, Plus, Trash2, Sparkles, ArrowLeft, Upload, Play } from "lucide-react";
import { api } from "@/lib/api/client";
import { useAdminAuth } from "@/lib/admin/auth-context";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Field, SelectField, Label } from "@/components/ui/form-fields";
import { Lightbox } from "@/components/store/lightbox";
import { getMaster, type MasterListDetail } from "@/lib/masters";
import { cn } from "@/lib/utils/cn";

interface Seller { id: string; name: string }
interface CatNode { id: string; name: string; variantAxisKeys: string[]; attributeKeys: string[]; children: CatNode[] }
interface CollectionOpt { id: string; title: string }
interface VariantRow { sku: string; price: string; mrp: string; costPrice: string; stock: string; barcode: string; weightGrams: string; lengthCm: string; widthCm: string; heightCm: string; isActive: boolean }
interface CustomField { label: string; type: string; required: boolean; options: string[] }

const STATUSES = [["DRAFT", "Draft"], ["ACTIVE", "Active"], ["ARCHIVED", "Archived"]];
const slugify = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const DEFAULT_KEY = "__default__";

const emptyVariant = (sku = ""): VariantRow => ({ sku, price: "", mrp: "", costPrice: "", stock: "0", barcode: "", weightGrams: "", lengthCm: "", widthCm: "", heightCm: "", isActive: true });

function combos(axes: string[], values: Record<string, string[]>): string[][] {
  if (!axes.length) return [];
  return axes.reduce<string[][]>((acc, ax) => {
    const vals = values[ax] ?? [];
    if (!vals.length) return acc;
    if (!acc.length) return vals.map((v) => [v]);
    return acc.flatMap((c) => vals.map((v) => [...c, v]));
  }, []);
}

function Card({ title, hint, children, right }: { title: string; hint?: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><h2 className="font-display text-lg">{title}</h2>{hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}</div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
      className={cn("relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors", on ? "bg-accent" : "bg-black/15 dark:bg-white/20")}>
      <span className={cn("inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform", on ? "translate-x-[22px]" : "translate-x-0.5")} />
    </button>
  );
}

export function ProductForm({ productId }: { productId?: string }) {
  const router = useRouter();
  const { storeId } = useAdminAuth();
  const confirm = useConfirm();
  const q = storeId ? `storeId=${storeId}` : "";

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [catTree, setCatTree] = useState<CatNode[]>([]);
  const [collections, setCollections] = useState<CollectionOpt[]>([]);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [masters, setMasters] = useState<Record<string, MasterListDetail>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [advanced, setAdvanced] = useState<Set<string>>(new Set());

  const [f, setF] = useState({
    title: "", description: "", sellerId: "", categoryId: "", brandId: "", status: "DRAFT", uom: "PIECE",
    hsnCode: "", gstRate: "", taxInclusive: true, discountable: true,
    isCustomizable: false, customizationFields: [] as CustomField[],
    axisValues: {} as Record<string, string[]>,
    variants: { [DEFAULT_KEY]: emptyVariant() } as Record<string, VariantRow>,
    specifications: {} as Record<string, string>,
    tags: "", metaTitle: "", metaDescription: "",
    returnable: "" as "" | "yes" | "no", returnWindowDays: "", minOrderQty: "", maxOrderQty: "",
    collectionIds: [] as string[],
    relatedProductIds: [] as string[],
    media: [] as { url: string; type: string; alt?: string; colours?: string[] }[],
  });
  const [allProducts, setAllProducts] = useState<{ id: string; title: string }[]>([]);
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }));

  const flatCats = useMemo(() => {
    const out: { c: CatNode; depth: number }[] = [];
    const walk = (nodes: CatNode[], d = 0) => nodes.forEach((c) => { out.push({ c, depth: d }); walk(c.children, d + 1); });
    walk(catTree);
    return out;
  }, [catTree]);
  const category = useMemo(() => flatCats.find((x) => x.c.id === f.categoryId)?.c, [flatCats, f.categoryId]);
  const axes = category?.variantAxisKeys ?? [];
  const specKeys = category?.attributeKeys ?? [];

  const ensureMaster = useCallback(async (key: string) => {
    if (!storeId) return;
    setMasters((m) => (m[key] ? m : m));
    const has = masters[key];
    if (has) return;
    const list = await getMaster(key, storeId);
    if (list) setMasters((m) => ({ ...m, [key]: list }));
  }, [storeId, masters]);

  useEffect(() => {
    if (!storeId) return;
    (async () => {
      const [sl, br, ct, co] = await Promise.all([
        api.get<{ items: Seller[] }>(`/sellers?${q}&limit=100`, { auth: true }),
        api.get<{ items: { id: string; name: string }[] }>(`/brands?${q}&limit=100`, { auth: true }),
        api.get<CatNode[]>(`/categories?${q}`, { auth: true }),
        api.get<{ items: CollectionOpt[] }>(`/collections?${q}&limit=100`, { auth: true }),
      ]);
      setSellers(sl.items); setBrands(br.items); setCatTree(ct); setCollections(co.items);
      api.get<{ items: { id: string; title: string }[] }>(`/products?${q}&limit=100`, { auth: true }).then((r) => setAllProducts(r.items)).catch(() => {});
      await Promise.all(["uom", "hsn"].map((k) => getMaster(k, storeId).then((l) => l && setMasters((m) => ({ ...m, [k]: l })))));
      if (!productId) setLoading(false);
    })();
  }, [storeId, q, productId]);

  // Load masters needed for the selected category's axes + specs.
  useEffect(() => { [...axes, ...specKeys].forEach((k) => ensureMaster(k)); }, [axes, specKeys, ensureMaster]);

  // Load product for edit.
  useEffect(() => {
    if (!productId || !storeId || sellers.length === 0) return;
    (async () => {
      const p = await api.get<Record<string, unknown>>(`/products/${productId}?${q}`, { auth: true });
      const axisKeys = (p.variantAxes as string[]) ?? [];
      const variants: Record<string, VariantRow> = {};
      const axisValues: Record<string, string[]> = {};
      const pv = (p.variants as Record<string, unknown>[]) ?? [];
      pv.forEach((v) => {
        const attrs = (v.attributes as Record<string, string>) ?? {};
        axisKeys.forEach((k) => { if (attrs[k]) axisValues[k] = Array.from(new Set([...(axisValues[k] ?? []), attrs[k]])); });
      });
      const activeKeys = axisKeys.filter((k) => (axisValues[k]?.length ?? 0) > 0);
      pv.forEach((v) => {
        const attrs = (v.attributes as Record<string, string>) ?? {};
        const key = activeKeys.length ? activeKeys.map((k) => attrs[k] ?? "").join("|") : DEFAULT_KEY;
        variants[key] = {
          sku: String(v.sku ?? ""), price: String(v.price ?? ""), mrp: v.mrp != null ? String(v.mrp) : "", costPrice: v.costPrice != null ? String(v.costPrice) : "",
          stock: String(v.stock ?? 0), barcode: String(v.barcode ?? ""), weightGrams: v.weightGrams != null ? String(v.weightGrams) : "",
          lengthCm: v.lengthCm != null ? String(v.lengthCm) : "", widthCm: v.widthCm != null ? String(v.widthCm) : "", heightCm: v.heightCm != null ? String(v.heightCm) : "",
          isActive: v.isActive !== false,
        };
      });
      const specs: Record<string, string> = {};
      ((p.specifications as { key: string; value: string }[]) ?? []).forEach((s) => { specs[s.key] = s.value; });
      const rr = p.returnable as boolean | null;
      const variantColour = new Map(pv.map((v) => [String(v.id ?? ""), ((v.attributes as Record<string, string> | null) ?? {}).colour]));
      setF((prev) => ({
        ...prev,
        title: String(p.title ?? ""), description: String(p.description ?? ""), sellerId: String((p.seller as { id: string })?.id ?? ""),
        categoryId: String((p.category as { id: string })?.id ?? ""), brandId: String((p.brand as { id: string })?.id ?? ""), status: String(p.status ?? "DRAFT"),
        uom: String(p.uom ?? "PIECE"), hsnCode: String(p.hsnCode ?? ""), gstRate: p.gstRate != null ? String(p.gstRate) : "",
        taxInclusive: p.taxInclusive !== false, discountable: p.discountable !== false,
        isCustomizable: !!p.isCustomizable, customizationFields: ((p.customizationFields as CustomField[]) ?? []).map((c) => ({ label: c.label, type: c.type, required: !!c.required, options: c.options ?? [] })),
        axisValues, variants: Object.keys(variants).length ? variants : { [DEFAULT_KEY]: emptyVariant() }, specifications: specs,
        tags: ((p.tags as string[]) ?? []).join(", "), metaTitle: String(p.metaTitle ?? ""), metaDescription: String(p.metaDescription ?? ""),
        returnable: rr === true ? "yes" : rr === false ? "no" : "", returnWindowDays: p.returnWindowDays != null ? String(p.returnWindowDays) : "",
        minOrderQty: p.minOrderQty != null ? String(p.minOrderQty) : "", maxOrderQty: p.maxOrderQty != null ? String(p.maxOrderQty) : "",
        collectionIds: ((p.collectionLinks as { collection: { id: string } }[]) ?? []).map((l) => l.collection.id),
        relatedProductIds: (p.relatedProductIds as string[]) ?? [],
        media: ((p.media as { url: string; type: string; alt?: string; variantId?: string | null; colours?: string[] }[]) ?? []).map((m) => ({ url: m.url, type: m.type, alt: m.alt, colours: m.colours?.length ? m.colours : (m.variantId && variantColour.get(m.variantId) ? [variantColour.get(m.variantId)!] : []) })),
      }));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, storeId, sellers.length]);

  const activeAxes = useMemo(() => axes.filter((a) => (f.axisValues[a]?.length ?? 0) > 0), [axes, f.axisValues]);
  const grid = useMemo(() => (axes.length ? combos(activeAxes, f.axisValues) : [[DEFAULT_KEY]]), [axes, activeAxes, f.axisValues]);
  function variantFor(comboKey: string): VariantRow {
    return f.variants[comboKey] ?? emptyVariant(autoSku(comboKey));
  }
  function autoSku(comboKey: string) {
    const base = slugify(f.title).toUpperCase().replace(/-/g, "").slice(0, 8) || "SKU";
    if (comboKey === DEFAULT_KEY) return base;
    return `${base}-${comboKey.split("|").map((v) => v.slice(0, 3).toUpperCase()).join("-")}`;
  }
  function setVariant(comboKey: string, patch: Partial<VariantRow>) {
    setF((p) => ({ ...p, variants: { ...p.variants, [comboKey]: { ...variantFor(comboKey), ...patch } } }));
  }
  const colourKey = axes.find((a) => a.toLowerCase().includes("colour") || a.toLowerCase().includes("color"));
  const productColours = colourKey ? (f.axisValues[colourKey] ?? []) : [];
  const toggleMediaColour = (i: number, colour: string) => set({
    media: f.media.map((m, j) => {
      if (j !== i) return m;
      const cur = m.colours ?? [];
      return { ...m, colours: cur.includes(colour) ? cur.filter((c) => c !== colour) : [...cur, colour] };
    }),
  });
  function toggleAxisValue(axis: string, val: string) {
    setF((p) => {
      const cur = p.axisValues[axis] ?? [];
      return { ...p, axisValues: { ...p.axisValues, [axis]: cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val] } };
    });
  }

  async function addMedia(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      if (file.size > 50 * 1024 * 1024) continue;
      const type = file.type.startsWith("video/") ? "VIDEO" : "IMAGE";
      try {
        const res = await api.upload<{ url: string }>(`/media/upload?folder=products`, file, { auth: true });
        setF((p) => ({ ...p, media: [...p.media, { url: res.url, type }] }));
      } catch (err) { setError((err as Error).message); }
    }
    setUploading(false);
  }

  function onHsn(code: string) {
    const item = masters.hsn?.items.find((i) => i.value === code);
    const gst = item?.metadata?.gst;
    set({ hsnCode: code, ...(gst != null ? { gstRate: String(gst) } : {}) });
  }

  async function submit(status?: string) {
    setBusy(true); setError(null);
    const keys = axes.length ? grid.map((c) => c.join("|")) : [DEFAULT_KEY];
    const variants = keys.map((k, i) => {
      const v = variantFor(k);
      const attributes = activeAxes.length ? Object.fromEntries(activeAxes.map((ax, ai) => [ax, k.split("|")[ai]])) : undefined;
      return {
        sku: v.sku || autoSku(k), attributes, price: Number(v.price || 0), mrp: v.mrp ? Number(v.mrp) : undefined, costPrice: v.costPrice ? Number(v.costPrice) : undefined,
        stock: Number(v.stock || 0), barcode: v.barcode || undefined, weightGrams: v.weightGrams ? Number(v.weightGrams) : undefined,
        lengthCm: v.lengthCm ? Number(v.lengthCm) : undefined, widthCm: v.widthCm ? Number(v.widthCm) : undefined, heightCm: v.heightCm ? Number(v.heightCm) : undefined,
        position: i, isActive: v.isActive,
      };
    });
    const payload: Record<string, unknown> = {
      sellerId: f.sellerId, categoryId: f.categoryId || null, title: f.title, description: f.description, brandId: f.brandId || null,
      status: status ?? f.status, uom: f.uom, hsnCode: f.hsnCode || undefined, gstRate: f.gstRate ? Number(f.gstRate) : undefined,
      taxInclusive: f.taxInclusive, discountable: f.discountable, variantAxes: axes,
      specifications: specKeys.map((k) => ({ key: k, label: masters[k]?.label ?? k, value: f.specifications[k] ?? "" })).filter((s) => s.value),
      tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      isCustomizable: f.isCustomizable, customizationFields: f.isCustomizable ? f.customizationFields.filter((c) => c.label) : [],
      metaTitle: f.metaTitle || undefined, metaDescription: f.metaDescription || undefined,
      returnable: f.returnable === "" ? undefined : f.returnable === "yes", returnWindowDays: f.returnWindowDays ? Number(f.returnWindowDays) : undefined,
      minOrderQty: f.minOrderQty ? Number(f.minOrderQty) : undefined, maxOrderQty: f.maxOrderQty ? Number(f.maxOrderQty) : undefined,
      collectionIds: f.collectionIds, relatedProductIds: f.relatedProductIds,
      media: f.media.map((m) => ({ url: m.url, type: m.type, alt: m.alt, colours: m.colours ?? [] })),
      variants,
    };
    try {
      if (productId) await api.patch(`/products/${productId}?${q}`, payload, { auth: true });
      else await api.post(`/products?${q}`, payload, { auth: true });
      router.push("/admin/products");
    } catch (err) { setError((err as Error).message); window.scrollTo({ top: 0, behavior: "smooth" }); }
    finally { setBusy(false); }
  }

  async function del() {
    if (!productId) return;
    const ok = await confirm({ title: `Delete “${f.title}”?`, message: "The product and its variants will be removed.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    await api.delete(`/products/${productId}?${q}`, { auth: true });
    router.push("/admin/products");
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted" /></div>;

  const disc = (mrp: string, price: string) => { const m = Number(mrp), p = Number(price); return m > 0 && p > 0 && m > p ? Math.round(((m - p) / m) * 100) : 0; };

  return (
    <div className="w-full pb-24">
      <div className="mb-5 flex items-center gap-3">
        <button onClick={() => router.push("/admin/products")} className="rounded-lg p-2 text-muted hover:bg-accent-soft"><ArrowLeft className="h-5 w-5" /></button>
        <h1 className="font-display text-2xl font-medium">{productId ? "Edit product" : "New product"}</h1>
      </div>
      {error && <p className="mb-4 rounded-lg bg-danger/10 p-3 text-sm text-danger">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card title="Basics">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label="Title" required placeholder="e.g. Classic Cotton T-Shirt" value={f.title} onChange={(v) => set({ title: v })} /></div>
              <SelectField label="Seller" required value={f.sellerId} onChange={(v) => set({ sellerId: v })}>
                <option value="">Select seller…</option>
                {sellers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </SelectField>
              <SelectField label="Category" value={f.categoryId} onChange={(v) => set({ categoryId: v })}>
                <option value="">Uncategorised</option>
                {flatCats.map((x) => <option key={x.c.id} value={x.c.id}>{"— ".repeat(x.depth)}{x.c.name}</option>)}
              </SelectField>
              <div className="sm:col-span-2"><Field label="Description" textarea placeholder="Describe the product" value={f.description} onChange={(v) => set({ description: v })} /></div>
            </div>
          </Card>

          <Card title="Media" hint={productColours.length > 0 ? "Add images/videos. First = main photo. Tag an image to one or more colours so the storefront shows it when any of them is picked (leave untagged for shared shots)." : "Add multiple images and videos. First image = main photo. Recommended 1200 × 1600px (3:4 portrait) · JPG/PNG · under 5 MB."}>
            <div className="flex flex-wrap gap-3">
              {f.media.map((m, i) => (
                <div key={i} className="group relative w-24">
                  <button type="button" onClick={() => setPreview(i)} className="relative block h-24 w-24 overflow-hidden rounded-xl border border-line" title="Preview">
                    {m.type === "VIDEO" ? (
                      <>
                        <video src={m.url} className="h-full w-full object-cover" />
                        <span className="pointer-events-none absolute inset-0 flex items-center justify-center"><Play className="h-6 w-6 text-white drop-shadow" /></span>
                      </>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.url} alt="" className="h-full w-full cursor-zoom-in object-cover" />
                    )}
                    {i === 0 ? (
                      <span className="pointer-events-none absolute left-1 top-1 rounded bg-accent px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">Main</span>
                    ) : null}
                  </button>
                  {i !== 0 && <button type="button" onClick={() => set({ media: [f.media[i], ...f.media.filter((_, j) => j !== i)] })} title="Set as main image" className="absolute left-1 top-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">Set main</button>}
                  <button type="button" onClick={() => set({ media: f.media.filter((_, j) => j !== i) })} className="absolute -right-2 -top-2 rounded-full bg-danger p-1 text-white" title="Remove"><Trash2 className="h-3 w-3" /></button>
                  {productColours.length > 0 && m.type !== "VIDEO" && (
                    <div className="mt-1 flex w-24 flex-wrap gap-1">
                      {productColours.map((c) => {
                        const on = (m.colours ?? []).includes(c);
                        return (
                          <button key={c} type="button" onClick={() => toggleMediaColour(i, c)} title={on ? `Shown when ${c} is picked` : `Tag to ${c}`}
                            className={cn("rounded-full border px-1.5 py-0.5 text-[10px] leading-none transition", on ? "border-accent bg-accent text-accent-foreground" : "border-line bg-canvas text-muted hover:border-accent")}>
                            {c}
                          </button>
                        );
                      })}
                      {!(m.colours ?? []).length && <span className="self-center text-[10px] leading-none text-muted">All colours</span>}
                    </div>
                  )}
                </div>
              ))}
              <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line text-xs text-muted hover:bg-accent-soft">
                {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                {uploading ? "Uploading" : "Add media"}
                <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { addMedia(e.target.files); e.target.value = ""; }} />
              </label>
            </div>
            {preview !== null && f.media[preview] && (
              <Lightbox media={f.media.map((m) => ({ url: m.url, type: m.type }))} start={preview} onClose={() => setPreview(null)} />
            )}
          </Card>

          <Card title="Variants" hint={axes.length ? `This ${category?.name} varies by ${axes.map((a) => masters[a]?.label ?? a).join(" × ")}. Pick the values, then fill price & stock.` : "Pick a category with variant axes (e.g. Size, Colour) to sell variations, or set a single price below."}>
            {axes.length > 0 && (
              <div className="mb-4 space-y-3">
                {axes.map((axis) => (
                  <div key={axis}>
                    <Label>{masters[axis]?.label ?? axis}</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {(masters[axis]?.items ?? []).filter((i) => i.isActive).map((it) => {
                        const on = (f.axisValues[axis] ?? []).includes(it.value);
                        const hex = it.metadata?.hex as string | undefined;
                        return (
                          <button key={it.id} type="button" onClick={() => toggleAxisValue(axis, it.value)}
                            className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", on ? "border-accent bg-accent text-accent-foreground" : "border-line hover:bg-accent-soft")}>
                            {hex && <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: hex }} />}{it.label}
                          </button>
                        );
                      })}
                      {(masters[axis]?.items ?? []).length === 0 && <span className="text-xs text-muted">No {masters[axis]?.label ?? axis} in Masters yet.</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted">
                    {activeAxes.map((a) => <th key={a} className="pb-2 pr-3 font-semibold">{masters[a]?.label ?? a}</th>)}
                    <th className="pb-2 pr-3 font-semibold" title="Your own item code. Leave blank and we'll generate one.">SKU</th>
                    <th className="pb-2 pr-3 font-semibold" title="Maximum retail price — shown struck-through when discounted.">MRP</th>
                    <th className="pb-2 pr-3 font-semibold" title="What the customer actually pays.">Price</th>
                    <th className="pb-2 pr-3 font-semibold" title="Discount % — filled automatically from MRP and Price.">Disc</th>
                    <th className="pb-2 pr-3 font-semibold">Stock</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {grid.length === 0 ? (
                    <tr><td colSpan={activeAxes.length + 6} className="py-4 text-sm text-muted">Select values above to generate variants.</td></tr>
                  ) : grid.map((combo) => {
                    const key = combo.join("|");
                    const v = variantFor(key);
                    const open = advanced.has(key);
                    return (
                      <Fragment key={key}>
                        <tr className="border-t border-line">
                          {activeAxes.map((a, ai) => <td key={a} className="py-2 pr-3 font-medium">{combo[ai]}</td>)}
                          <td className="py-2 pr-3"><input value={v.sku} onChange={(e) => setVariant(key, { sku: e.target.value })} placeholder={autoSku(key)} className="h-9 w-32 rounded-lg border border-line bg-canvas px-2 text-xs outline-none focus:border-accent" /></td>
                          <td className="py-2 pr-3"><input value={v.mrp} onChange={(e) => setVariant(key, { mrp: e.target.value })} placeholder="0" className="h-9 w-20 rounded-lg border border-line bg-canvas px-2 text-sm outline-none focus:border-accent" /></td>
                          <td className="py-2 pr-3"><input value={v.price} onChange={(e) => setVariant(key, { price: e.target.value })} placeholder="0" className="h-9 w-20 rounded-lg border border-line bg-canvas px-2 text-sm outline-none focus:border-accent" /></td>
                          <td className="py-2 pr-3 text-xs text-accent">{disc(v.mrp, v.price) ? `${disc(v.mrp, v.price)}%` : "—"}</td>
                          <td className="py-2 pr-3"><input value={v.stock} onChange={(e) => setVariant(key, { stock: e.target.value })} placeholder="0" className="h-9 w-16 rounded-lg border border-line bg-canvas px-2 text-sm outline-none focus:border-accent" /></td>
                          <td className="py-2"><button type="button" onClick={() => setAdvanced((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; })} className="rounded p-1 text-muted hover:bg-accent-soft">{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button></td>
                        </tr>
                        {open && (
                          <tr className="border-t border-line/50 bg-canvas/40">
                            <td colSpan={activeAxes.length + 6} className="px-2 py-3">
                              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <label className="text-xs"><span className="mb-1 block text-muted">Cost price</span><input value={v.costPrice} onChange={(e) => setVariant(key, { costPrice: e.target.value })} className="h-9 w-full rounded-lg border border-line bg-card px-2 text-sm outline-none focus:border-accent" /></label>
                                <label className="text-xs"><span className="mb-1 block text-muted">Barcode</span><input value={v.barcode} onChange={(e) => setVariant(key, { barcode: e.target.value })} className="h-9 w-full rounded-lg border border-line bg-card px-2 text-sm outline-none focus:border-accent" /></label>
                                <label className="text-xs"><span className="mb-1 block text-muted">Weight (g)</span><input value={v.weightGrams} onChange={(e) => setVariant(key, { weightGrams: e.target.value })} className="h-9 w-full rounded-lg border border-line bg-card px-2 text-sm outline-none focus:border-accent" /></label>
                                <label className="flex items-center gap-2 text-xs"><Toggle on={v.isActive} onChange={(val) => setVariant(key, { isActive: val })} /> Active</label>
                                <label className="text-xs"><span className="mb-1 block text-muted">Length (cm)</span><input value={v.lengthCm} onChange={(e) => setVariant(key, { lengthCm: e.target.value })} className="h-9 w-full rounded-lg border border-line bg-card px-2 text-sm outline-none focus:border-accent" /></label>
                                <label className="text-xs"><span className="mb-1 block text-muted">Width (cm)</span><input value={v.widthCm} onChange={(e) => setVariant(key, { widthCm: e.target.value })} className="h-9 w-full rounded-lg border border-line bg-card px-2 text-sm outline-none focus:border-accent" /></label>
                                <label className="text-xs"><span className="mb-1 block text-muted">Height (cm)</span><input value={v.heightCm} onChange={(e) => setVariant(key, { heightCm: e.target.value })} className="h-9 w-full rounded-lg border border-line bg-card px-2 text-sm outline-none focus:border-accent" /></label>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {specKeys.length > 0 && (
            <Card title="Specifications" hint="Product details shown on the page (from this category's setup).">
              <div className="grid gap-4 sm:grid-cols-2">
                {specKeys.map((k) => {
                  const m = masters[k];
                  const items = (m?.items ?? []).filter((i) => i.isActive);
                  return (
                    <label key={k} className="block">
                      <Label>{m?.label ?? k}</Label>
                      {items.length ? (
                        <SelectField label="" value={f.specifications[k] ?? ""} onChange={(v) => set({ specifications: { ...f.specifications, [k]: v } })}>
                          <option value="">—</option>
                          {items.map((it) => <option key={it.id} value={it.value}>{it.label}</option>)}
                        </SelectField>
                      ) : (
                        <input value={f.specifications[k] ?? ""} onChange={(e) => set({ specifications: { ...f.specifications, [k]: e.target.value } })} className="h-11 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" />
                      )}
                    </label>
                  );
                })}
              </div>
            </Card>
          )}

          <Card title="Customisation" hint="Let customers personalise (name, image, notes) at order time — like embroidery." right={<Toggle on={f.isCustomizable} onChange={(v) => set({ isCustomizable: v })} />}>
            {f.isCustomizable ? (
              <div className="space-y-2">
                {f.customizationFields.map((cf, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input value={cf.label} onChange={(e) => set({ customizationFields: f.customizationFields.map((x, j) => j === i ? { ...x, label: e.target.value } : x) })} placeholder="Field label (e.g. Name to print)" className="h-9 flex-1 min-w-[160px] rounded-lg border border-line bg-canvas px-2.5 text-sm outline-none focus:border-accent" />
                    <select value={cf.type} onChange={(e) => set({ customizationFields: f.customizationFields.map((x, j) => j === i ? { ...x, type: e.target.value } : x) })} className="h-9 rounded-lg border border-line bg-canvas px-2 text-sm outline-none focus:border-accent">
                      {["text", "textarea", "number", "select", "image"].map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {cf.type === "select" && <input value={cf.options.join(", ")} onChange={(e) => set({ customizationFields: f.customizationFields.map((x, j) => j === i ? { ...x, options: e.target.value.split(",").map((o) => o.trim()).filter(Boolean) } : x) })} placeholder="options, comma separated" className="h-9 flex-1 min-w-[140px] rounded-lg border border-line bg-canvas px-2.5 text-sm outline-none focus:border-accent" />}
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={cf.required} onChange={(e) => set({ customizationFields: f.customizationFields.map((x, j) => j === i ? { ...x, required: e.target.checked } : x) })} className="h-4 w-4 accent-[var(--accent)]" /> required</label>
                    <button type="button" onClick={() => set({ customizationFields: f.customizationFields.filter((_, j) => j !== i) })} className="rounded-lg p-1.5 text-danger hover:bg-danger/10"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => set({ customizationFields: [...f.customizationFields, { label: "", type: "text", required: false, options: [] }] })} className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs hover:bg-accent-soft"><Plus className="h-3.5 w-3.5" /> Add field</button>
              </div>
            ) : <p className="text-sm text-muted">Off — this is a standard product.</p>}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Status">
            <SelectField label="" value={f.status} onChange={(v) => set({ status: v })}>{STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</SelectField>
          </Card>

          <Card title="Pricing & tax">
            <div className="space-y-3">
              <SelectField label="Brand" value={f.brandId} onChange={(v) => set({ brandId: v })}>
                <option value="">No brand</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </SelectField>
              <label className="block"><Label>HSN code</Label>
                <input list="hsn-list" value={f.hsnCode} onChange={(e) => onHsn(e.target.value)} placeholder="e.g. 6109" className="h-11 w-full rounded-lg border border-line bg-canvas px-3 text-sm outline-none focus:border-accent" />
                <datalist id="hsn-list">{(masters.hsn?.items ?? []).map((h) => <option key={h.id} value={h.value}>{h.label}</option>)}</datalist>
                <span className="mt-1 block text-xs text-muted/70">Government tax code for the product — pick from the list to auto-fill GST%.</span>
              </label>
              <Field label="GST %" placeholder="auto from HSN" value={f.gstRate} onChange={(v) => set({ gstRate: v })} />
              <SelectField label="Unit of measure" value={f.uom} onChange={(v) => set({ uom: v })}>
                {(masters.uom?.items ?? []).map((u) => <option key={u.id} value={u.value}>{u.label}</option>)}
              </SelectField>
              <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2"><span className="text-sm">Price incl. GST</span><Toggle on={f.taxInclusive} onChange={(v) => set({ taxInclusive: v })} /></div>
              <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2"><span className="text-sm">Allow discounts</span><Toggle on={f.discountable} onChange={(v) => set({ discountable: v })} /></div>
            </div>
          </Card>

          <Card title="Organisation">
            <div className="space-y-3">
              <div>
                <Label>Collections</Label>
                <div className="flex flex-wrap gap-1.5">
                  {collections.length === 0 && <span className="text-xs text-muted">No collections yet.</span>}
                  {collections.map((c) => {
                    const on = f.collectionIds.includes(c.id);
                    return <button key={c.id} type="button" onClick={() => set({ collectionIds: on ? f.collectionIds.filter((x) => x !== c.id) : [...f.collectionIds, c.id] })} className={cn("rounded-full border px-3 py-1.5 text-xs", on ? "border-accent bg-accent text-accent-foreground" : "border-line hover:bg-accent-soft")}>{c.title}</button>;
                  })}
                </div>
              </div>
              <Field label="Tags (comma separated)" placeholder="summer, cotton" value={f.tags} onChange={(v) => set({ tags: v })} />
              <div>
                <Label>Related products <span className="font-normal normal-case text-muted/70">— shown as &ldquo;complete the look&rdquo; on the product page</span></Label>
                <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                  {allProducts.filter((rp) => rp.id !== productId).length === 0 && <span className="text-xs text-muted">Add more products first.</span>}
                  {allProducts.filter((rp) => rp.id !== productId).map((rp) => {
                    const on = f.relatedProductIds.includes(rp.id);
                    return <button key={rp.id} type="button" onClick={() => set({ relatedProductIds: on ? f.relatedProductIds.filter((x) => x !== rp.id) : [...f.relatedProductIds, rp.id] })} className={cn("rounded-full border px-3 py-1.5 text-xs", on ? "border-accent bg-accent text-accent-foreground" : "border-line hover:bg-accent-soft")}>{rp.title}</button>;
                  })}
                </div>
                <p className="mt-1 text-xs text-muted/70">Leave empty to auto-show products from the same category.</p>
              </div>
            </div>
          </Card>

          <Card title="Policies">
            <div className="space-y-3">
              <SelectField label="Returns" value={f.returnable} onChange={(v) => set({ returnable: v as "" | "yes" | "no" })}>
                <option value="">Inherit from seller</option>
                <option value="yes">Returnable</option>
                <option value="no">Not returnable</option>
              </SelectField>
              {f.returnable === "yes" && <Field label="Return window (days)" value={f.returnWindowDays} onChange={(v) => set({ returnWindowDays: v })} />}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Min qty" value={f.minOrderQty} onChange={(v) => set({ minOrderQty: v })} />
                <Field label="Max qty" value={f.maxOrderQty} onChange={(v) => set({ maxOrderQty: v })} />
              </div>
            </div>
          </Card>

          <Card title="Search & sharing" hint="How this product looks on Google and when shared. Leave blank to use the product title and description.">
            <div className="space-y-3">
              <Field label="Google title" placeholder="Defaults to product title" value={f.metaTitle} onChange={(v) => set({ metaTitle: v })} />
              <Field label="Google description" textarea placeholder="Short summary shown under the title in search results" value={f.metaDescription} onChange={(v) => set({ metaDescription: v })} />
            </div>
          </Card>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card/95 backdrop-blur md:left-64">
        <div className="flex items-center justify-between gap-3 px-5 py-3 lg:px-6">
          <div>{productId && <button onClick={del} className="text-sm text-danger hover:underline">Delete</button>}</div>
          <div className="flex items-center gap-2">
            <button onClick={() => submit("DRAFT")} disabled={busy || !f.title || !f.sellerId} className="rounded-full border border-line px-5 py-2.5 text-sm font-medium hover:bg-accent-soft disabled:opacity-50">Save draft</button>
            <button onClick={() => submit("ACTIVE")} disabled={busy || !f.title || !f.sellerId} className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} {productId ? "Save" : "Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
