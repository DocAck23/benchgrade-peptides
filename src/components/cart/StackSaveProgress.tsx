"use client";

import { Check } from "lucide-react";
import { useCart } from "@/lib/cart/CartContext";
import { cn } from "@/lib/utils";

/**
 * StackSaveProgress — live cart-tier progress for the Stack & Save program.
 *
 * Reads `totals` and `nextTier` straight from `useCart()` (Wave 2d). Pure
 * presentation: no props, no local state. Hidden when the cart is empty.
 *
 * Tiers (from `discounts.ts`):
 *   2 vials → free domestic shipping
 *   3 vials → 15% off
 *   5 vials → 20% off
 *   8 vials → 25% off + free 5mg vial of choice
 *  12 vials → 28% off + free 10mg vial of choice
 *
 * The "active-tier" eyebrow shows the highest currently-unlocked benefit. The
 * progress bar fills toward the next tier; when there is no next tier (vials
 * ≥ 12) we celebrate "All tiers unlocked" with no bar.
 */
export function StackSaveProgress() {
  const { totals, nextTier } = useCart();

  if (totals.vial_count === 0) return null;

  const activeLabel = currentTierLabel(totals);

  return (
    <div className="space-y-2">
      {activeLabel && (
        <div className="flex items-center gap-1.5 label-eyebrow text-gold-dark">
          <Check className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />
          <span>{activeLabel}</span>
        </div>
      )}

      {nextTier ? (
        <>
          <p className="text-xs text-ink-soft leading-snug">{nextTier.message}</p>
          <div
            className="h-px w-full bg-paper-soft border rule overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={nextTier.progress_pct}
            aria-label="Stack & Save progress"
          >
            <div
              className={cn("h-full bg-gold transition-all duration-300")}
              style={{ width: `${nextTier.progress_pct}%` }}
            />
          </div>
        </>
      ) : (
        <p className="text-xs text-ink-soft leading-snug">
          All tiers unlocked — your free 10mg vial of choice ships with the order.
        </p>
      )}
    </div>
  );
}

function currentTierLabel(totals: ReturnType<typeof useCart>["totals"]): string | null {
  const pct = totals.stack_save_tier_percent;
  const free = totals.free_vial_entitlement;
  if (pct === 28) return "28% off + free 10mg vial unlocked";
  if (pct === 25) return "25% off + free 5mg vial unlocked";
  if (pct === 20) return "20% off unlocked";
  if (pct === 15) return "15% off unlocked";
  if (totals.free_shipping) return "Free shipping unlocked";
  // pct === 0 and no free shipping → vial_count is 1; nothing unlocked yet.
  void free;
  return null;
}

export default StackSaveProgress;
