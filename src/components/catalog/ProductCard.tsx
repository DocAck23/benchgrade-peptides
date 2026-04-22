import Image from "next/image";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalog/data";
import { getMinPrice, getMaxPrice } from "@/lib/catalog/data";
import { formatPrice } from "@/lib/utils";

interface ProductCardProps {
  product: CatalogProduct;
  categorySlug: string;
}

/**
 * Product card for the catalog grid.
 *
 * Uniform sizing: every card is the same height regardless of how long
 * the compound name, molecular formula, or summary text is. The image
 * area is fixed at aspect-[4/5]; the text area uses fixed-height rows
 * with truncate/line-clamp for variable content.
 */
export function ProductCard({ product, categorySlug }: ProductCardProps) {
  const minPrice = getMinPrice(product);
  const maxPrice = getMaxPrice(product);
  const priceRange = minPrice === maxPrice
    ? formatPrice(minPrice * 100)
    : `${formatPrice(minPrice * 100)} – ${formatPrice(maxPrice * 100)}`;
  const sizes = product.variants.map((v) => `${v.size_mg}mg`).join(" · ");

  return (
    <Link
      href={`/catalog/${categorySlug}/${product.slug}`}
      className="group flex flex-col bg-paper border rule p-6 hover:bg-paper-soft transition-colors focus-visible:outline-none focus-visible:bg-paper-soft"
    >
      {/* Vial photograph — fixed aspect ratio for uniform card height */}
      <div className="relative aspect-[4/5] bg-paper-deep border rule mb-4 overflow-hidden">
        <Image
          src={product.vial_image}
          alt={`${product.name} research vial`}
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
          className="object-cover"
        />
      </div>

      {/* Text area — fixed-height rows for uniform layout across cards */}
      <div className="flex-1 flex flex-col">
        {/* Molecular formula — single line, truncated */}
        <div className="h-4 mb-2">
          {product.molecular_formula && (
            <span className="font-mono-data text-[11px] text-ink-muted block truncate">
              {product.molecular_formula}
            </span>
          )}
        </div>

        {/* Compound name — fixed height, single line, truncated */}
        <h3 className="font-display text-xl text-ink leading-tight mb-2 truncate h-7">
          {product.name}
        </h3>

        {/* Summary — fixed height, two-line clamp */}
        <p className="text-xs text-ink-muted mb-4 leading-relaxed line-clamp-2 h-8">
          {product.summary}
        </p>

        {/* Footer — pinned to bottom for uniform alignment */}
        <div className="mt-auto pt-4 border-t rule flex items-baseline justify-between gap-2">
          <span className="font-mono-data text-sm text-ink whitespace-nowrap">{priceRange}</span>
          <span className="label-eyebrow text-ink-muted truncate">{sizes}</span>
        </div>
      </div>
    </Link>
  );
}
