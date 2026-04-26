import { cn } from "@/lib/utils";
import type { AffiliateTier } from "@/lib/affiliate/tiers";

/**
 * TierBadge — pure visual badge for an affiliate's tier (Wave B2 §C-AFFDASH).
 *
 * Variants per spec §8:
 *   - bronze  → gold-dark on paper, neutral rule (entry tier)
 *   - silver  → ink-soft on paper-soft, gold-dark border
 *   - gold    → gold-dark on paper-soft, gold-dark border
 *   - eminent → gold text on wine background (prestige tier)
 *
 * Cinzel uppercase tracked, 12px, rounded-sm — matches OrderStatusPill /
 * SubscriptionStatusPill chrome but with the display face for hierarchy.
 */

export type TierBadgeProps = { tier: AffiliateTier };

interface Variant {
  label: string;
  className: string;
}

function variantFor(tier: AffiliateTier): Variant {
  switch (tier) {
    case "bronze":
      return {
        label: "Bronze",
        className: "bg-paper text-gold-dark border rule",
      };
    case "silver":
      return {
        label: "Silver",
        className: "bg-paper-soft text-ink-soft border border-gold-dark",
      };
    case "gold":
      return {
        label: "Gold",
        className: "bg-paper-soft text-gold-dark border border-gold-dark",
      };
    case "eminent":
      return {
        label: "Eminent",
        className: "bg-wine text-gold border border-gold",
      };
  }
}

export function TierBadge({ tier }: TierBadgeProps) {
  const v = variantFor(tier);
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-1 rounded-sm uppercase",
        "font-display text-[12px] tracking-[0.14em]",
        v.className
      )}
      data-tier={tier}
    >
      {v.label}
    </span>
  );
}

export default TierBadge;
