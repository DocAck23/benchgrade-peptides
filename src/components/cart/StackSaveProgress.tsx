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
    <div className="space-y-3 px-3 py-3 bg-paper-soft border border-rule rounded-sm">
      {activeLabel && (
        <div className="flex items-center gap-2 text-[13px] font-display uppercase tracking-[0.1em] font-semibold text-gold-dark">
          <Check className="w-4 h-4" strokeWidth={2.5} aria-hidden />
          <span>{activeLabel}</span>
        </div>
      )}

      {nextTier ? (
        <>
          <p className="text-sm text-ink leading-snug font-medium">
            {nextTier.message}
          </p>
          <div className="space-y-1">
            <div
              className="h-2 w-full bg-paper border border-rule overflow-hidden rounded-sm"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={nextTier.progress_pct}
              aria-label="Stack & Save progress"
            >
              <div
                className={cn(
                  "h-full bg-gradient-to-r from-gold to-gold-dark transition-all duration-300 ease-out"
                )}
                style={{ width: `${nextTier.progress_pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono-data text-ink-muted">
              <span>{totals.vial_count} {totals.vial_count === 1 ? "vial" : "vials"}</span>
              <span className="text-gold-dark font-semibold">{nextTier.progress_pct}%</span>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-ink leading-snug font-medium">
          ✦ All tiers unlocked — your free 10mg vial of choice ships with the order.
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
