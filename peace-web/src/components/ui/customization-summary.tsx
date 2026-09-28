/* eslint-disable @next/next/no-img-element */
const isImageUrl = (v: unknown): v is string =>
  typeof v === "string" && /^https?:\/\/\S+\.(png|jpe?g|webp|gif|avif|svg)(\?\S*)?$/i.test(v);

// Personalisation a shopper chose for an order line; photos show as thumbnails.
export function CustomizationSummary({ values, className }: { values?: Record<string, unknown> | null; className?: string }) {
  const entries = Object.entries(values ?? {}).filter(([, v]) => v !== "" && v != null);
  if (!entries.length) return null;
  return (
    <div className={className ?? "mt-1 space-y-1 text-xs text-muted"}>
      {entries.map(([k, v]) =>
        isImageUrl(v) ? (
          <div key={k} className="flex items-center gap-2">
            <span>{k}:</span>
            <a href={v} target="_blank" rel="noreferrer">
              <img src={v} alt={k} className="h-12 w-12 rounded-md border border-line object-cover" />
            </a>
          </div>
        ) : (
          <p key={k}>{k}: {String(v)}</p>
        ),
      )}
    </div>
  );
}
