import Image from "next/image";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalogue/data";
import { QuickAddButton } from "./QuickAddButton";

interface ProductCardProps {
  product: CatalogProduct;
  categorySlug: string;
  /**
   * Customer's tier-driven own-order discount percent (0–10). When >0,
   * the QuickAddButton shows a strikethrough retail price above the
   * personalized one. Default 0 (anonymous viewer or Initiate tier).
   */
  tierDiscountPct?: number;
}

/**
 * Product card for the catalogue grid.
 *
 * The card is intentionally sparse — image, formula, name, summary,
 * and the QuickAddButton block. The price/size/qty machinery lives
 * inside QuickAddButton so a single point price reflects the chosen
 * variant + quantity (no more "$110 – $400" range that confused
 * customers about the entry-level cost).
 */
export function ProductCard({
  product,
  categorySlug,
  tierDiscountPct = 0,
}: ProductCardProps) {
  return (
    <article className="group flex flex-col bg-paper border rule p-2 sm:p-5 lg:p-6 hover:bg-paper-soft transition-colors">
      <Link
        href={`/catalogue/${categorySlug}/${product.slug}`}
        className="flex flex-col flex-1 focus-visible:outline-none focus-visible:bg-paper-soft"
      >
        {/* Vial photograph — fixed aspect ratio for uniform card height */}
        <div className="relative aspect-square bg-paper-soft border rule mb-2 sm:mb-4 overflow-hidden">
          <Image
            src={product.vial_image}
            alt={`${product.name} research vial`}
            fill
            sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 33vw"
            className="object-cover scale-[1.1] [object-position:60%_50%]"
          />
        </div>

        {/* Text area — fixed-height rows for uniform layout across cards */}
        <div className="flex-1 flex flex-col">
          {/* Molecular formula — hidden on mobile (3-per-row leaves no
              room) but kept from sm up where it's a useful identifier. */}
          <div className="hidden sm:block h-4 mb-2">
            {product.molecular_formula && (
              <span className="font-mono-data text-[11px] text-ink-muted block truncate">
                {product.molecular_formula}
              </span>
            )}
          </div>

          {/* Compound name — allow 2 lines on every breakpoint so long
              names don't get ellipsis-truncated. */}
          <h3 className="font-display text-sm sm:text-lg lg:text-xl text-ink leading-tight mb-1 sm:mb-2 line-clamp-2 min-h-[2.6em] sm:min-h-0 sm:h-[3em]">
            {product.name}
          </h3>

          {/* Summary — hidden on mobile; from sm up reserves 3 lines. */}
          <p className="hidden sm:block text-[13px] text-ink-muted mb-4 leading-snug line-clamp-3 h-[3.9em]">
            {product.summary}
          </p>
        </div>
      </Link>

      {/* Quick-add — sibling to the Link so the size/qty controls and
          Add button don't trigger the parent navigation. Hidden on
          mobile (3-per-row leaves no room); customers tap the card
          to land on the PDP and add from there. */}
      <div className="hidden sm:block mt-3 sm:mt-4">
        <QuickAddButton
          product={product}
          size="sm"
          tierDiscountPct={tierDiscountPct}
        />
      </div>
    </article>
  );
}
