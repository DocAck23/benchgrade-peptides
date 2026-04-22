import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog/data";
import { getMinPrice, getMaxPrice } from "@/lib/catalog/data";
import { formatPrice } from "@/lib/utils";

interface ProductCardProps {
  product: CatalogProduct;
  categorySlug: string;
}

export function ProductCard({ product, categorySlug }: ProductCardProps) {
  const minPrice = getMinPrice(product);
  const maxPrice = getMaxPrice(product);
  const priceRange = minPrice === maxPrice ? formatPrice(minPrice * 100) : `${formatPrice(minPrice * 100)} – ${formatPrice(maxPrice * 100)}`;
  const sizes = product.variants.map((v) => `${v.size_mg}mg`).join(" · ");

  return (
    <Link
      href={`/catalog/${categorySlug}/${product.slug}`}
      className="group flex flex-col bg-paper border rule p-6 hover:bg-paper-soft transition-colors focus-visible:outline-none focus-visible:bg-paper-soft"
    >
      {/* Placeholder for vial photograph — will be replaced with real generated images */}
      <div className="aspect-[4/5] bg-paper-deep border rule mb-4 flex items-center justify-center">
        <span className="font-mono-data text-[10px] text-ink-faint tracking-widest uppercase">
          vial · photo pending
        </span>
      </div>

      <div className="flex-1 flex flex-col">
        {product.molecular_formula && (
          <span className="font-mono-data text-[11px] text-ink-muted mb-2 truncate">
            {product.molecular_formula}
          </span>
        )}
        <h3 className="font-display text-xl text-ink leading-tight mb-2">
          {product.name}
        </h3>
        <p className="text-xs text-ink-muted mb-4 line-clamp-2 leading-relaxed">
          {product.summary}
        </p>

        <div className="mt-auto pt-4 border-t rule flex items-baseline justify-between">
          <span className="font-mono-data text-sm text-ink">{priceRange}</span>
          <span className="label-eyebrow text-ink-muted">{sizes}</span>
        </div>
      </div>
    </Link>
  );
}
