import { Heart, Star } from "lucide-react";
import { Placeholder } from "@/components/ui/placeholder";

export interface ProductCardData {
  id: string;
  name: string;
  category: string;
  price: string;
  compareAt?: string;
  rating?: number;
  badge?: string;
}

export function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <article className="group relative flex flex-col">
      <div className="relative overflow-hidden rounded-2xl bg-card">
        <Placeholder ratio="aspect-[4/5]" className="rounded-2xl transition-transform duration-500 group-hover:scale-105" />

        {product.badge && (
          <span className="absolute left-3 top-3 rounded-full bg-ink px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-canvas">
            {product.badge}
          </span>
        )}

        <button
          type="button"
          aria-label="Add to wishlist"
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-canvas/90 text-ink opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 hover:bg-canvas"
        >
          <Heart className="h-4 w-4" />
        </button>

        <div className="absolute inset-x-3 bottom-3 translate-y-3 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <button
            type="button"
            className="w-full rounded-full bg-ink py-3 text-xs font-semibold uppercase tracking-widest text-canvas hover:bg-accent hover:text-accent-foreground"
          >
            Add to cart
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted">
            {product.category}
          </p>
          {product.rating && (
            <span className="flex items-center gap-1 text-xs text-muted">
              <Star className="h-3 w-3 fill-current text-accent" />
              {product.rating.toFixed(1)}
            </span>
          )}
        </div>
        <h3 className="font-display text-lg leading-snug">{product.name}</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{product.price}</span>
          {product.compareAt && (
            <span className="text-sm text-muted line-through">{product.compareAt}</span>
          )}
        </div>
      </div>
    </article>
  );
}
