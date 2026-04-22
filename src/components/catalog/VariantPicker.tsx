"use client";

import { useState } from "react";
import type { CatalogVariant } from "@/lib/catalog/data";
import { Button } from "@/components/ui";
import { formatPrice, cn } from "@/lib/utils";

interface VariantPickerProps {
  variants: readonly CatalogVariant[];
  productName: string;
  onAddToCart?: (variant: CatalogVariant, quantity: number) => void;
}

/**
 * Variant selection + qty stepper + add-to-cart.
 *
 * Triggers the RUO gate modal on first cart-add. The modal is owned by
 * the CartProvider upstream; this component only signals intent via `onAddToCart`.
 */
export function VariantPicker({ variants, productName, onAddToCart }: VariantPickerProps) {
  const [selectedSku, setSelectedSku] = useState(variants[0]?.sku ?? "");
  const [quantity, setQuantity] = useState(1);

  const selectedVariant = variants.find((v) => v.sku === selectedSku) ?? variants[0];
  if (!selectedVariant) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="label-eyebrow text-ink-muted mb-3">Size</div>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={`${productName} size`}>
          {variants.map((variant) => {
            const selected = variant.sku === selectedSku;
            return (
              <button
                key={variant.sku}
                role="radio"
                aria-checked={selected}
                onClick={() => setSelectedSku(variant.sku)}
                className={cn(
                  "flex items-baseline justify-between px-4 py-3 border transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2",
                  selected
                    ? "border-ink bg-paper-soft"
                    : "rule bg-paper hover:bg-paper-soft"
                )}
              >
                <span className="font-mono-data text-sm text-ink">{variant.size_mg}mg</span>
                <span className="font-mono-data text-sm text-ink-soft">
                  {formatPrice(variant.retail_price * 100)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="label-eyebrow text-ink-muted">Qty</div>
        <div className="flex items-stretch border rule">
          <button
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={quantity <= 1}
            className="w-10 h-11 flex items-center justify-center text-ink-soft hover:bg-paper-soft disabled:text-ink-faint focus-visible:outline-none focus-visible:bg-paper-soft"
            aria-label="Decrease quantity"
          >
            −
          </button>
          <input
            type="number"
            min={1}
            max={99}
            value={quantity}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!Number.isNaN(n)) setQuantity(Math.max(1, Math.min(99, n)));
            }}
            className="w-14 h-11 text-center bg-paper text-ink font-mono-data text-sm border-x rule focus:outline-none"
            aria-label="Quantity"
          />
          <button
            onClick={() => setQuantity(Math.min(99, quantity + 1))}
            disabled={quantity >= 99}
            className="w-10 h-11 flex items-center justify-center text-ink-soft hover:bg-paper-soft disabled:text-ink-faint focus-visible:outline-none focus-visible:bg-paper-soft"
            aria-label="Increase quantity"
          >
            +
          </button>
        </div>
      </div>

      <Button
        size="lg"
        onClick={() => onAddToCart?.(selectedVariant, quantity)}
        disabled={!onAddToCart}
      >
        Add to cart — {formatPrice(selectedVariant.retail_price * quantity * 100)}
      </Button>
    </div>
  );
}
