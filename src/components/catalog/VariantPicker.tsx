"use client";

import { useState } from "react";
import type { CatalogProduct, CatalogVariant } from "@/lib/catalog/data";
import { perVialPrice } from "@/lib/catalog/data";
import { Button } from "@/components/ui";
import { useCart } from "@/lib/cart/CartContext";
import { formatPrice, cn } from "@/lib/utils";

interface VariantPickerProps {
  product: CatalogProduct;
}

/**
 * Pack-tier selector.
 *
 * Each product has one dose (`dose_mg`) and three pack tiers (1, 5, 10).
 * The 10-pack is surfaced as Inner Circle pricing — cheapest per vial.
 * Quantity on cart = number of packs; default 1 (user can bump in the cart).
 */
export function VariantPicker({ product }: VariantPickerProps) {
  const { variants } = product;
  const sorted = [...variants].sort((a, b) => a.pack_size - b.pack_size);
  const { addItem } = useCart();
  const [selectedSku, setSelectedSku] = useState(sorted[0]?.sku ?? "");

  const selectedVariant: CatalogVariant | undefined =
    sorted.find((v) => v.sku === selectedSku) ?? sorted[0];
  if (!selectedVariant) return null;

  const totalPriceCents = Math.round(selectedVariant.retail_price * 100);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <span className="label-eyebrow text-ink-muted">Pack size</span>
          <span className="font-mono-data text-xs text-ink-muted">
            {product.dose_mg}mg per vial
          </span>
        </div>
        <div className="flex flex-col gap-2" role="radiogroup" aria-label={`${product.name} pack size`}>
          {sorted.map((variant) => {
            const selected = variant.sku === selectedSku;
            const isInnerCircle = variant.pack_size === 10;
            return (
              <button
                key={variant.sku}
                role="radio"
                aria-checked={selected}
                onClick={() => setSelectedSku(variant.sku)}
                className={cn(
                  "flex items-baseline justify-between gap-4 px-4 py-3 border transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2",
                  selected ? "border-ink bg-paper-soft" : "rule bg-paper hover:bg-paper-soft"
                )}
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-mono-data text-sm text-ink">
                    {variant.pack_size} {variant.pack_size === 1 ? "vial" : "vials"}
                  </span>
                  {isInnerCircle && (
                    <span className="label-eyebrow text-teal text-[10px]">Inner Circle</span>
                  )}
                </span>
                <span className="flex items-baseline gap-3">
                  <span className="font-mono-data text-xs text-ink-muted">
                    {formatPrice(perVialPrice(variant) * 100)} / vial
                  </span>
                  <span className="font-mono-data text-sm text-ink">
                    {formatPrice(variant.retail_price * 100)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Button size="lg" onClick={() => addItem(product, selectedVariant, 1)}>
        Add to cart — {formatPrice(totalPriceCents)}
      </Button>
    </div>
  );
}
