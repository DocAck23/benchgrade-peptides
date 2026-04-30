"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Minus, Plus } from "lucide-react";
import type { CatalogProduct, CatalogVariant } from "@/lib/catalogue/data";
import { useCart } from "@/lib/cart/CartContext";
import { formatPrice, cn } from "@/lib/utils";

/**
 * Compact quick-add block at the bottom of every product card.
 *
 * Layout (top → bottom):
 *   1. Live price line — reflects (variant × quantity).
 *   2. Size + quantity selectors on one row.
 *   3. Full-width Add to cart button.
 *
 * This is now the SOURCE OF TRUTH for the card's price display. The
 * old card footer used to show a "$110 – $400" range to advertise
 * the lowest-and-highest variant prices; founder asked for a single
 * point price that responds to the size selector instead. Defaulting
 * to the smallest variant (5mg in the canonical catalog ordering)
 * keeps the on-load price low and approachable.
 *
 * Click + change handlers stop propagation so the surrounding card
 * Link doesn't navigate when the user touches the controls.
 */
export function QuickAddButton({
  product,
  size = "md",
  className,
  /**
   * When the parent card needs the personal-price (tier-discounted)
   * value reflected in the live price line, pass the discount %.
   * 0 (default) shows retail.
   */
  tierDiscountPct = 0,
}: {
  product: CatalogProduct;
  size?: "sm" | "md";
  className?: string;
  tierDiscountPct?: number;
}) {
  const { addItem } = useCart();
  // Default variant is the first one — catalog data is ordered lowest
  // mg first, so this lands on 5mg / 10mg etc. as appropriate.
  const [variantSku, setVariantSku] = useState(
    () => product.variants[0]?.sku ?? "",
  );
  const [quantity, setQuantity] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);

  const variant: CatalogVariant | undefined = product.variants.find(
    (v) => v.sku === variantSku,
  );

  const linePriceCents = useMemo(() => {
    if (!variant) return 0;
    const cents = Math.round(variant.retail_price * 100);
    const after =
      tierDiscountPct > 0
        ? Math.round(cents * (1 - tierDiscountPct / 100))
        : cents;
    return after * Math.max(1, quantity);
  }, [variant, quantity, tierDiscountPct]);

  if (!variant) return null;

  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(() => {
      addItem(product, variant, Math.max(1, Math.min(20, quantity)));
      setConfirmed(true);
      setTimeout(() => setConfirmed(false), 1800);
    });
  };

  const stopBubble = (e: React.SyntheticEvent) => e.stopPropagation();
  const isSm = size === "sm";

  // Quantity bounds: 1 lower (always at least one), 20 upper (matches
  // the existing server-side CartLineSchema cap so a bigger number
  // here would just bounce at submit).
  const setQtyClamped = (n: number) =>
    setQuantity(Math.max(1, Math.min(20, n)));

  const showsPersonalPrice = tierDiscountPct > 0;
  const retailLineCents =
    Math.round(variant.retail_price * 100) * Math.max(1, quantity);

  return (
    <div
      onClick={stopBubble}
      onMouseDown={stopBubble}
      onKeyDown={stopBubble}
      className={cn("flex flex-col gap-2 w-full", className)}
    >
      {/* Live price — single point value, updates on variant + qty.
          When the customer has a tier discount, show the retail
          struck-through above the personal price. */}
      <div className="flex items-baseline justify-between gap-2 min-h-[1.5rem]">
        {showsPersonalPrice ? (
          <span className="flex items-baseline gap-2">
            <span
              className="font-mono-data text-[11px] text-ink-muted line-through"
              title="Retail price"
            >
              {formatPrice(retailLineCents)}
            </span>
            <span
              className="font-mono-data text-sm sm:text-base text-gold-dark font-semibold"
              title="Your tier price — additional cart discounts may apply at checkout"
            >
              {formatPrice(linePriceCents)}
            </span>
          </span>
        ) : (
          <span className="font-mono-data text-sm sm:text-base text-ink font-semibold">
            {formatPrice(linePriceCents)}
          </span>
        )}
        {quantity > 1 && (
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink-muted font-display">
            × {quantity}
          </span>
        )}
      </div>

      {/* Size + quantity row */}
      <div className="flex items-stretch gap-1.5">
        {product.variants.length > 1 ? (
          <select
            value={variantSku}
            onChange={(e) => {
              e.stopPropagation();
              setVariantSku(e.target.value);
            }}
            onClick={stopBubble}
            className={cn(
              "flex-1 min-w-0 bg-paper border border-rule text-ink font-mono-data hover:border-gold-dark focus:outline-none focus:ring-2 focus:ring-gold-light",
              isSm ? "px-2 py-1.5 text-[11px]" : "px-2.5 py-2 text-xs",
            )}
            aria-label={`Vial size for ${product.name}`}
          >
            {product.variants.map((v) => (
              <option key={v.sku} value={v.sku}>
                {v.size_mg}mg
              </option>
            ))}
          </select>
        ) : (
          <span
            className={cn(
              "flex-1 min-w-0 inline-flex items-center bg-paper border border-rule text-ink-muted font-mono-data",
              isSm ? "px-2 py-1.5 text-[11px]" : "px-2.5 py-2 text-xs",
            )}
            aria-label={`Vial size: ${variant.size_mg}mg`}
          >
            {variant.size_mg}mg
          </span>
        )}

        {/* Quantity stepper. Min 1 / max 20 (matches server cap). */}
        <div
          className={cn(
            "shrink-0 inline-flex items-stretch border border-rule bg-paper",
            isSm ? "text-[11px]" : "text-xs",
          )}
          role="group"
          aria-label={`Quantity for ${product.name}`}
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setQtyClamped(quantity - 1);
            }}
            disabled={quantity <= 1}
            className={cn(
              "px-2 text-ink-muted hover:text-ink hover:bg-paper-soft disabled:opacity-40 disabled:hover:bg-transparent transition-colors",
              isSm ? "py-1.5" : "py-2",
            )}
            aria-label="Decrease quantity"
          >
            <Minus className="w-3 h-3" strokeWidth={2} aria-hidden />
          </button>
          <span
            className={cn(
              "inline-flex items-center justify-center min-w-[1.75rem] font-mono-data text-ink",
              isSm ? "px-1" : "px-1.5",
            )}
            aria-live="polite"
          >
            {quantity}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setQtyClamped(quantity + 1);
            }}
            disabled={quantity >= 20}
            className={cn(
              "px-2 text-ink-muted hover:text-ink hover:bg-paper-soft disabled:opacity-40 disabled:hover:bg-transparent transition-colors",
              isSm ? "py-1.5" : "py-2",
            )}
            aria-label="Increase quantity"
          >
            <Plus className="w-3 h-3" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>

      {/* Full-width Add — pill-shaped CTA (Foundation Q3 lock + user
          direct ask: "Pill sized add to carts"). Confirmation animation:
          flashes wine pill + scales up briefly + check icon scales in,
          then resets after 1.8s. */}
      <button
        type="button"
        onClick={onAdd}
        disabled={isPending}
        className={cn(
          "w-full relative inline-flex items-center justify-center gap-1.5 rounded-pill font-ui font-semibold uppercase tracking-[0.10em]",
          "transition-all duration-300 ease-out disabled:opacity-60",
          confirmed
            ? "bg-wine text-paper border border-wine scale-[1.02] shadow-[0_8px_18px_-4px_rgba(74,14,26,0.45)]"
            : "bg-gold text-wine border border-gold hover:bg-gold-light hover:scale-[1.01] active:scale-[0.99] shadow-[0_6px_14px_rgba(184,146,84,0.30)]",
          isSm ? "px-3 py-2 text-[11px]" : "px-3.5 py-2.5 text-xs",
        )}
        aria-label={`Add ${quantity} × ${product.name} ${variant.size_mg}mg to cart`}
      >
        {confirmed ? (
          <>
            <Check className="w-3.5 h-3.5 animate-[scaleIn_220ms_ease-out]" strokeWidth={2.5} aria-hidden />
            <span>Added to cart</span>
          </>
        ) : (
          <>
            <Plus className="w-3 h-3" strokeWidth={2.5} aria-hidden />
            <span>Add to cart</span>
          </>
        )}
      </button>
    </div>
  );
}

export default QuickAddButton;
