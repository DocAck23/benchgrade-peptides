"use client";

import { useState } from "react";
import type { CatalogProduct, CatalogVariant } from "@/lib/catalog/data";
import { QUANTITY_TIERS } from "@/lib/catalog/data";
import { Button } from "@/components/ui";
import { useCart } from "@/lib/cart/CartContext";
import { formatPrice, cn } from "@/lib/utils";

interface VariantPickerProps {
  product: CatalogProduct;
}

export function VariantPicker({ product }: VariantPickerProps) {
  const { variants, name: productName } = product;
  const { addItem } = useCart();
  const [selectedSku, setSelectedSku] = useState(variants[0]?.sku ?? "");
  const [quantity, setQuantity] = useState<number>(QUANTITY_TIERS[0]);

  const selectedVariant: CatalogVariant | undefined =
    variants.find((v) => v.sku === selectedSku) ?? variants[0];
  if (!selectedVariant) return null;

  const totalPriceCents = Math.round(selectedVariant.retail_price * quantity * 100);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="label-eyebrow text-ink-muted mb-3">Dosage</div>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={`${productName} dosage`}>
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
                  selected ? "border-ink bg-paper-soft" : "rule bg-paper hover:bg-paper-soft"
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

      <div>
        <div className="flex items-baseline justify-between mb-3">
          <span className="label-eyebrow text-ink-muted">Quantity (vials)</span>
          {quantity > 1 && (
            <span className="font-mono-data text-xs text-ink-muted">
              {quantity}× {formatPrice(selectedVariant.retail_price * 100)}
            </span>
          )}
        </div>
        <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Quantity">
          {QUANTITY_TIERS.map((tier) => {
            const selected = tier === quantity;
            return (
              <button
                key={tier}
                role="radio"
                aria-checked={selected}
                onClick={() => setQuantity(tier)}
                className={cn(
                  "flex items-center justify-center px-3 py-3 border transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2",
                  selected ? "border-ink bg-paper-soft" : "rule bg-paper hover:bg-paper-soft"
                )}
                aria-label={`${tier} ${tier === 1 ? "vial" : "vials"}`}
              >
                <span className="font-mono-data text-sm text-ink">{tier}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Button
        size="lg"
        onClick={() => addItem(product, selectedVariant, quantity)}
      >
        Add to cart — {formatPrice(totalPriceCents)}
      </Button>
    </div>
  );
}
