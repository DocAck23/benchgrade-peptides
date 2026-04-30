"use client";

import { useState } from "react";
import type { CatalogProduct, CatalogVariant } from "@/lib/catalogue/data";
import { Button } from "@/components/ui";
import { useCart } from "@/lib/cart/CartContext";
import { formatPrice, cn } from "@/lib/utils";

interface VariantPickerProps {
  product: CatalogProduct;
}

const QTY_MIN = 1;
const QTY_MAX = 100;

/**
 * Dose + quantity selector.
 *
 * Each product has 1+ dose variants (e.g. 5mg / 10mg / 30mg). Customer
 * picks a dose and a vial count (any integer in [1, 100]). Total =
 * variant.retail_price × quantity. Volume discounts are not in catalog
 * data — they're applied later via cart-level rules.
 */
export function VariantPicker({ product }: VariantPickerProps) {
  const sortedDoses = [...product.variants].sort((a, b) => a.size_mg - b.size_mg);
  const { addItem } = useCart();
  const [selectedSku, setSelectedSku] = useState(sortedDoses[0]?.sku ?? "");
  const [quantity, setQuantity] = useState(1);

  const selectedVariant: CatalogVariant | undefined =
    sortedDoses.find((v) => v.sku === selectedSku) ?? sortedDoses[0];
  if (!selectedVariant) return null;

  const isMultiDose = sortedDoses.length > 1;
  const isVial =
    product.container === "vial-3ml" || product.container === "vial-10ml";
  const unitNoun = isVial ? "vial" : "unit";

  const totalCents = Math.round(selectedVariant.retail_price * quantity * 100);

  function clampQty(v: number): number {
    if (Number.isNaN(v)) return QTY_MIN;
    return Math.max(QTY_MIN, Math.min(QTY_MAX, Math.floor(v)));
  }

  return (
    <div className="flex flex-col gap-6">
      {isMultiDose && (
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <span className="label-eyebrow text-ink-muted">Dose</span>
            <span className="font-mono-data text-xs text-ink-muted">
              choose vial size
            </span>
          </div>
          <div
            className="flex flex-col gap-2"
            role="radiogroup"
            aria-label={`${product.name} dose`}
          >
            {sortedDoses.map((variant) => {
              const selected = variant.sku === selectedSku;
              return (
                <button
                  key={variant.sku}
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSelectedSku(variant.sku)}
                  className={cn(
                    "flex items-baseline justify-between gap-4 px-4 py-3 border transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2",
                    selected
                      ? "border-ink bg-paper-soft"
                      : "rule bg-paper hover:bg-paper-soft"
                  )}
                >
                  <span className="font-mono-data text-sm text-ink">
                    {variant.size_mg} mg
                    <span className="text-ink-muted"> per {unitNoun}</span>
                  </span>
                  <span className="font-mono-data text-sm text-ink">
                    {formatPrice(variant.retail_price * 100)} / {unitNoun}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!isMultiDose && (
        <div className="flex items-baseline justify-between px-4 py-3 border rule bg-paper">
          <span className="font-mono-data text-sm text-ink">
            {selectedVariant.size_mg} mg
            <span className="text-ink-muted"> per {unitNoun}</span>
          </span>
          <span className="font-mono-data text-sm text-ink">
            {formatPrice(selectedVariant.retail_price * 100)} / {unitNoun}
          </span>
        </div>
      )}

      {/* Praetorian-style PDP quantity: pill-shaped stepper, no typed
          input. User direct ask: "quantity button needs to be like
          praetorianpeptides.com". One pill control with -/readout/+,
          48px tall to align with the gold Add-to-cart pill below. */}
      <div>
        <div className="flex items-baseline justify-between mb-3">
          <span className="font-ui uppercase text-[11px] tracking-[0.18em] font-bold text-gold-dark">Quantity</span>
          <span className="font-mono-data text-xs text-ink-muted">
            {QTY_MIN}–{QTY_MAX} {unitNoun}s
          </span>
        </div>
        <div className="flex items-stretch gap-3">
          <div className="inline-flex items-stretch border border-rule rounded-pill bg-paper overflow-hidden">
            <button
              type="button"
              aria-label="decrease quantity"
              onClick={() => setQuantity((q) => clampQty(q - 1))}
              disabled={quantity <= QTY_MIN}
              className="w-12 h-12 text-ink-muted hover:text-ink hover:bg-paper-soft disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-lg font-ui font-semibold"
            >
              −
            </button>
            <span
              className="w-14 h-12 inline-flex items-center justify-center font-mono-data text-base text-ink select-none"
              aria-live="polite"
              aria-label={`Quantity: ${quantity}`}
            >
              {quantity}
            </span>
            <button
              type="button"
              aria-label="increase quantity"
              onClick={() => setQuantity((q) => clampQty(q + 1))}
              disabled={quantity >= QTY_MAX}
              className="w-12 h-12 text-ink-muted hover:text-ink hover:bg-paper-soft disabled:opacity-40 disabled:hover:bg-transparent transition-colors text-lg font-ui font-semibold"
            >
              +
            </button>
          </div>
          <span className="self-center font-mono-data text-xs text-ink-muted">
            ×&nbsp;{formatPrice(selectedVariant.retail_price * 100)}
          </span>
        </div>
      </div>

      <Button variant="primary" size="lg" onClick={() => addItem(product, selectedVariant, quantity)}>
        Add to cart — {formatPrice(totalCents)}
      </Button>
    </div>
  );
}
