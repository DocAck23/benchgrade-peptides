import Image from "next/image";
import Link from "next/link";
import type { CatalogProduct } from "@/lib/catalogue/data";
import { getMinPrice, getMaxPrice } from "@/lib/catalogue/data";
import { formatPrice } from "@/lib/utils";
import { QuickAddButton } from "./QuickAddButton";

interface ProductCardProps {
  product: CatalogProduct;
  categorySlug: string;
  /**
   * Customer's tier-driven own-order discount percent (0–10). When >0,
   * the card shows a strikethrough on the retail price and the
   * personalized price next to it. Default 0 (anonymous viewer or
   * Initiate tier).
   */
  tierDiscountPct?: number;
}

/**
 * Product card for the catalogue grid.
 *
 * Uniform sizing: every card is the same height regardless of how long
 * the compound name, molecular formula, or summary text is. The image
 * area is fixed at aspect-[4/5]; the text area uses fixed-height rows
 * with truncate/line-clamp for variable content.
 */
export function ProductCard({
  product,
  categorySlug,
  tierDiscountPct = 0,
}: ProductCardProps) {
  const minPrice = getMinPrice(product);
  const maxPrice = getMaxPrice(product);
  const priceRange = minPrice === maxPrice
    ? formatPrice(minPrice * 100)
    : `${formatPrice(minPrice * 100)} – ${formatPrice(maxPrice * 100)}`;
  const showsPersonalPrice = tierDiscountPct > 0;
  const personalMin = showsPersonalPrice
    ? minPrice * (1 - tierDiscountPct / 100)
    : minPrice;
  const personalMax = showsPersonalPrice
    ? maxPrice * (1 - tierDiscountPct / 100)
    : maxPrice;
  const personalPriceRange =
    personalMin === personalMax
      ? formatPrice(Math.round(personalMin * 100))
      : `${formatPrice(Math.round(personalMin * 100))} – ${formatPrice(Math.round(personalMax * 100))}`;
  const sizes = product.variants.map((v) => `${v.size_mg}mg`).join(" · ");

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
            names like "Hexarelin Acetate 5mg" or "Melanotan-2" don't
            get ellipsis-truncated. Reserved height holds 2 lines of
            the sm:text-lg face cleanly. */}
        <h3 className="font-display text-[12px] sm:text-lg lg:text-xl text-ink leading-tight mb-1 sm:mb-2 line-clamp-2 min-h-[2.4em] sm:min-h-0 sm:h-[3em]">
          {product.name}
        </h3>

        {/* Summary — hidden on mobile; from sm up reserves 3 lines at
            text-xs / leading-snug. Previous version was clamped to 2
            lines but the h-8 box was too short for two leading-relaxed
            lines, so the description visually clipped mid-line — the
            "cut off" issue founder reported. */}
        <p className="hidden sm:block text-xs text-ink-muted mb-4 leading-snug line-clamp-3 h-[3.75em]">
          {product.summary}
        </p>

        {/* Footer — pinned to bottom. Mobile shows just price; sizes
            badge gets squeezed off at 3-per-row so we drop it. */}
        <div className="mt-auto pt-2 sm:pt-4 border-t rule flex items-baseline justify-between gap-1 sm:gap-2">
          {/* Personal price = retail × (1 - tier %). Cart-level
              discounts (Stack & Save, same-SKU multiplier, etc.)
              compound on top at checkout, so the final cart total is
              typically lower than what the card shows. We label this
              as the customer's "tier base" rather than the final
              checkout price to avoid implying it's locked in. */}
          <span className="flex items-baseline gap-1.5 whitespace-nowrap">
            {showsPersonalPrice ? (
              <>
                <span
                  className="font-mono-data text-[11px] sm:text-sm text-ink-muted line-through"
                  title="Retail price"
                >
                  {priceRange}
                </span>
                <span
                  className="font-mono-data text-[11px] sm:text-sm text-gold-dark font-semibold"
                  title={`Your tier base price — additional cart discounts may apply at checkout`}
                >
                  {personalPriceRange}
                </span>
              </>
            ) : (
              <span className="font-mono-data text-[11px] sm:text-sm text-ink">
                {priceRange}
              </span>
            )}
          </span>
          <span className="hidden sm:block label-eyebrow text-ink-muted truncate text-xs max-w-[60%] text-right">{sizes}</span>
        </div>
      </div>
      </Link>

      {/* Quick-add — sibling to the Link so the variant select can be
          focused and the Add button can be clicked without triggering the
          parent navigation. Hidden on mobile (3-per-row has no room). */}
      <div className="hidden sm:block mt-3 sm:mt-4">
        <QuickAddButton product={product} size="sm" />
      </div>
    </article>
  );
}
