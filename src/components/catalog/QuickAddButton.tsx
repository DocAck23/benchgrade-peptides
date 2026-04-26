"use client";

import { useState, useTransition } from "react";
import { Check, Plus } from "lucide-react";
import type { CatalogProduct, CatalogVariant } from "@/lib/catalog/data";
import { useCart } from "@/lib/cart/CartContext";
import { formatPrice, cn } from "@/lib/utils";

/**
 * Compact quick-add CTA for product cards (catalog grid + homepage
 * carousel + popular-stack-grid mini-cards). Defaults the variant to
 * the product's smallest size; when the product has multiple variants
 * a select sits beside the Add button so the customer can pick a
 * different size without leaving the card.
 *
 * Click stops propagation so embedding inside a click-through card
 * doesn't trigger the parent navigation.
 */
export function QuickAddButton({
  product,
  size = "md",
  className,
}: {
  product: CatalogProduct;
  size?: "sm" | "md";
  className?: string;
}) {
  const { addItem } = useCart();
  const [variantSku, setVariantSku] = useState(
    () => product.variants[0]?.sku ?? ""
  );
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);

  const variant: CatalogVariant | undefined = product.variants.find(
    (v) => v.sku === variantSku
  );
  if (!variant) return null;

  const onAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(() => {
      addItem(product, variant, 1);
      setConfirmed(true);
      setTimeout(() => setConfirmed(false), 1800);
    });
  };

  const stopBubble = (e: React.SyntheticEvent) => e.stopPropagation();

  const isSm = size === "sm";

  return (
    <div
      onClick={stopBubble}
      onMouseDown={stopBubble}
      onKeyDown={stopBubble}
      className={cn(
        "flex items-stretch gap-1.5 w-full",
        className
      )}
    >
      {product.variants.length > 1 && (
        <select
          value={variantSku}
          onChange={(e) => {
            e.stopPropagation();
            setVariantSku(e.target.value);
          }}
          onClick={stopBubble}
          className={cn(
            "flex-1 min-w-0 bg-paper border border-rule text-ink font-mono-data hover:border-gold-dark focus:outline-none focus:ring-2 focus:ring-gold-light",
            isSm ? "px-2 py-1.5 text-[11px]" : "px-2.5 py-2 text-xs"
          )}
          aria-label={`Vial size for ${product.name}`}
        >
          {product.variants.map((v) => (
            <option key={v.sku} value={v.sku}>
              {v.size_mg}mg · {formatPrice(v.retail_price * 100)}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        onClick={onAdd}
        disabled={isPending}
        className={cn(
          "shrink-0 inline-flex items-center justify-center gap-1.5 bg-wine text-paper font-display uppercase tracking-[0.06em] border border-wine hover:bg-gold hover:text-ink hover:border-gold transition-colors duration-200 disabled:opacity-60",
          product.variants.length > 1
            ? isSm
              ? "px-3 py-1.5 text-[11px]"
              : "px-3.5 py-2 text-xs"
            : isSm
              ? "w-full px-3 py-1.5 text-[11px]"
              : "w-full px-3.5 py-2 text-xs"
        )}
        aria-label={`Add ${product.name} ${variant.size_mg}mg to cart`}
      >
        {confirmed ? (
          <>
            <Check className="w-3 h-3" strokeWidth={2.5} aria-hidden />
            <span>Added</span>
          </>
        ) : (
          <>
            <Plus className="w-3 h-3" strokeWidth={2.5} aria-hidden />
            <span>Add</span>
          </>
        )}
      </button>
    </div>
  );
}

export default QuickAddButton;
