"use client";

import { useState, useTransition } from "react";
import { Check, Plus } from "lucide-react";
import { useCart } from "@/lib/cart/CartContext";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { ResolvedPopularStack } from "@/lib/catalogue/stacks";

/**
 * Adds every line of a popular stack to the cart in one click. Each line
 * is a (CatalogProduct, CatalogVariant, quantity) tuple already resolved
 * server-side via resolveStack(). The button confirms with a transient
 * check-icon state, then opens the cart drawer so the customer sees the
 * Stack & Save tier they just unlocked.
 *
 * Idempotent in spirit: clicking twice doubles the quantity (matches the
 * generic addItem behavior — spec'd for one-shot stacking, not toggle).
 */
export function AddStackToCartButton({ resolved }: { resolved: ResolvedPopularStack }) {
  const { addItem, openDrawer } = useCart();
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = useState(false);

  const onClick = () => {
    if (resolved.lines.length === 0) return;
    startTransition(() => {
      for (const { product, variant, line } of resolved.lines) {
        addItem(product, variant, line.quantity);
      }
      setConfirmed(true);
      openDrawer();
      // Reset confirmation state after the drawer opens so a second click
      // shows fresh feedback if the customer adds another stack.
      setTimeout(() => setConfirmed(false), 2000);
    });
  };

  const disabled = isPending || resolved.lines.length === 0;

  return (
    <Button
      variant="gold"
      size="lg"
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn("w-full justify-center gap-2 transition-colors duration-200")}
      aria-label={`Add ${resolved.stack.name} to cart`}
    >
      {confirmed ? (
        <>
          <Check className="w-4 h-4" strokeWidth={2.5} aria-hidden />
          <span>Added to cart</span>
        </>
      ) : (
        <>
          <Plus className="w-4 h-4" strokeWidth={2.5} aria-hidden />
          <span>Add to cart</span>
        </>
      )}
    </Button>
  );
}

export default AddStackToCartButton;
