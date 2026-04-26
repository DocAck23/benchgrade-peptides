"use client";

import { useMemo } from "react";
import type { CartItem } from "@/lib/cart/types";
import { useCart } from "@/lib/cart/CartContext";
import { PRODUCTS } from "@/lib/catalog/data";
import { formatPrice } from "@/lib/utils";

/**
 * In-cart vial-size selector. Renders a compact dropdown of every
 * available variant for the cart item's product. On change, calls
 * changeItemVariant() which atomically swaps the line's SKU + price
 * (or merges into an existing line if the target variant is already
 * in the cart).
 *
 * Hidden when the product has only one variant.
 */
export function CartItemVariantSelect({ item }: { item: CartItem }) {
  const { changeItemVariant } = useCart();
  const product = useMemo(
    () => PRODUCTS.find((p) => p.slug === item.product_slug),
    [item.product_slug]
  );
  if (!product || product.variants.length <= 1) return null;

  return (
    <label className="block">
      <span className="sr-only">Vial size for {item.name}</span>
      <select
        value={item.sku}
        onChange={(e) => {
          const v = product.variants.find((vv) => vv.sku === e.target.value);
          if (v) changeItemVariant(item.sku, product, v);
        }}
        className="block w-full bg-paper border border-rule text-ink px-2 py-1 font-mono-data text-[11px] sm:text-xs hover:border-gold-dark focus:outline-none focus:ring-2 focus:ring-gold-light"
        aria-label={`Vial size for ${item.name}`}
      >
        {product.variants.map((v) => (
          <option key={v.sku} value={v.sku}>
            {v.size_mg}mg · {formatPrice(v.retail_price * 100)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default CartItemVariantSelect;
