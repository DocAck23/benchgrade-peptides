import { TIER_SPECS, tierSpec } from "@/lib/rewards/tiers";
import type { RewardTier } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";

/**
 * Visual ladder showing the customer's position in the tier system.
 *
 * Renders five rungs (Initiate → Laureate). The current rung is
 * filled gold; reached-but-not-current rungs are gold-outline; future
 * rungs are paper. Hover/long-press surfaces the unlock for each
 * rung. Mobile-first horizontal layout that wraps to a single
 * vertical column under sm so the labels never truncate.
 */
interface TierLadderProps {
  currentTier: RewardTier;
  currentPoints: number;
}

export function TierLadder({ currentTier, currentPoints }: TierLadderProps) {
  const currentIdx = TIER_SPECS.findIndex((s) => s.tier === currentTier);
  const current = tierSpec(currentTier);

  return (
    <div className="border rule bg-paper p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="label-eyebrow text-ink-muted mb-1">Your tier</div>
          <h2 className="font-display text-2xl text-ink">{current.label}</h2>
        </div>
        <div className="text-right">
          <div className="font-mono-data text-2xl text-ink leading-none">
            {currentPoints.toLocaleString()}
          </div>
          <div className="label-eyebrow text-ink-muted mt-1">12-mo points</div>
        </div>
      </div>

      {/* Horizontal ladder on sm+; vertical stack under sm so labels
          never truncate on small phones. */}
      <ol
        className="grid gap-2 sm:grid-cols-5 sm:gap-3"
        aria-label="Tier ladder"
      >
        {TIER_SPECS.map((spec, idx) => {
          const reached = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <li
              key={spec.tier}
              className={cn(
                "flex sm:flex-col items-start sm:items-center gap-3 sm:gap-1 rounded-sm border-2 px-3 py-3 sm:py-4 transition-colors",
                isCurrent
                  ? "border-gold bg-gold/15"
                  : reached
                    ? "border-gold-dark/60 bg-paper-soft"
                    : "border-rule bg-paper",
              )}
              aria-current={isCurrent ? "step" : undefined}
            >
              <span
                className={cn(
                  "shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full font-display text-[11px] font-bold",
                  isCurrent
                    ? "bg-gold text-ink"
                    : reached
                      ? "bg-gold-dark/40 text-ink"
                      : "bg-paper-soft text-ink-muted border rule",
                )}
                aria-hidden="true"
              >
                {idx + 1}
              </span>
              <div className="sm:text-center min-w-0">
                <div
                  className={cn(
                    "font-display uppercase text-[11px] tracking-[0.14em] leading-tight",
                    isCurrent ? "text-ink" : reached ? "text-ink-soft" : "text-ink-muted",
                  )}
                >
                  {spec.label}
                </div>
                <div
                  className={cn(
                    "font-mono-data text-[10px] mt-0.5 leading-tight",
                    isCurrent ? "text-ink-soft" : "text-ink-muted",
                  )}
                >
                  {spec.threshold.toLocaleString()}+ pts
                </div>
                <div
                  className={cn(
                    "text-[11px] mt-1 leading-tight",
                    isCurrent ? "text-ink" : "text-ink-muted",
                  )}
                >
                  {spec.ownDiscountPct}% off · link {spec.referralLinkPct}%
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
