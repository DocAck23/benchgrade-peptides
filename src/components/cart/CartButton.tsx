"use client";

import { useCart } from "@/lib/cart/CartContext";

export function CartButton() {
  const { itemCount, openDrawer } = useCart();
  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={itemCount > 0 ? `Cart, ${itemCount} items` : "Cart"}
      className="relative text-base px-4 py-2 border rule text-ink hover:bg-paper-soft transition-colors"
    >
      Cart
      {itemCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute -top-2 -right-2 min-w-5 h-5 px-1 bg-teal text-paper text-[11px] font-mono-data flex items-center justify-center rounded-full"
        >
          {itemCount}
        </span>
      )}
    </button>
  );
}
