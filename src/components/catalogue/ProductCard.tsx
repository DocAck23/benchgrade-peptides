import Image from "next/image";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalogue/data";
import { getMinPrice, getMaxPrice } from "@/lib/catalogue/data";
import { formatPrice } from "@/lib/utils";
import { QuickAddButton } from "./QuickAddButton";

interface ProductCardProps {
  product: CatalogProduct;
  categorySlug: string;
}

/**
 * Product card for the catalogue grid.
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
    <article className="group flex flex-col bg-paper border rule p-3 sm:p-5 lg:p-6 hover:bg-paper-soft transition-colors">
      <Link
        href={`/catalogue/${categorySlug}/${product.slug}`}
        className="flex flex-col flex-1 focus-visible:outline-none focus-visible:bg-paper-soft"
      >
      {/* Vial photograph — fixed aspect ratio for uniform card height */}
      <div className="relative aspect-[4/5] bg-paper-soft border rule mb-3 sm:mb-4 overflow-hidden">
        <Image
          src={product.vial_image}
          alt={`${product.name} research vial`}
          fill
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 50vw"
          className="object-cover scale-[1.2] [object-position:35%_50%]"
        />
      </div>

      {/* Text area — fixed-height rows for uniform layout across cards */}
      <div className="flex-1 flex flex-col">
        {/* Molecular formula — compact mono line at every breakpoint.
            Hiding it on mobile stripped a key product identifier, so we
            keep it at a smaller size instead. */}
        <div className="h-4 mb-1 sm:mb-2">
          {product.molecular_formula && (
            <span className="font-mono-data text-[9px] sm:text-[11px] text-ink-muted block truncate">
              {product.molecular_formula}
            </span>
          )}
        </div>

        {/* Compound name — wraps to two lines on mobile so long names like
            "VIP (Vasoactive Intestinal Peptide)" stay readable at 320px. */}
        <h3 className="font-display text-sm sm:text-lg lg:text-xl text-ink leading-tight mb-1 sm:mb-2 line-clamp-2 sm:line-clamp-1 sm:h-7">
          {product.name}
        </h3>

        {/* Summary — compact mobile excerpt, full two-line clamp from sm up. */}
        <p className="text-[11px] sm:text-xs text-ink-muted mb-2 sm:mb-4 leading-snug sm:leading-relaxed line-clamp-2 sm:h-8">
          {product.summary}
        </p>

        {/* Footer — pinned to bottom. Sizes uses shortest form "5,10mg" on
            mobile so multi-variant products (e.g. 5 size tiers) don't clip
            the label. */}
        <div className="mt-auto pt-2 sm:pt-4 border-t rule flex items-baseline justify-between gap-1 sm:gap-2">
          <span className="font-mono-data text-xs sm:text-sm text-ink whitespace-nowrap">{priceRange}</span>
          <span className="label-eyebrow text-ink-muted truncate text-[9px] sm:text-xs max-w-[60%] text-right">{sizes}</span>
        </div>
      </div>
      </Link>

      {/* Quick-add — sibling to the Link so the variant select can be
          focused and the Add button can be clicked without triggering the
          parent navigation. */}
      <div className="mt-3 sm:mt-4">
        <QuickAddButton product={product} size="sm" />
      </div>
    </article>
  );
}
