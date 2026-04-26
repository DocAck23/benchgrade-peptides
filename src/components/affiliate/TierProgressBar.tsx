import { TierBadge } from "./TierBadge";
import { nextTier, type AffiliateTier } from "@/lib/affiliate/tiers";
import { formatPrice, cn } from "@/lib/utils";

/**
 * TierProgressBar — pure visualization of progress toward the next tier.
 *
 * Two parallel rails: refs and earnings. Whichever fills first promotes
 * (OR-semantic per `affiliateTier`). The Eminent tier shows a celebratory
 * "Top tier reached." state with no rail.
 */

export interface TierProgressBarProps {
  current: AffiliateTier;
  totalRefs: number;
  totalEarned: number; // cents
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 100;
  return Math.max(0, Math.min(100, (numerator / denominator) * 100));
}

export function TierProgressBar({
  current,
  totalRefs,
  totalEarned,
}: TierProgressBarProps) {
  const target = nextTier(current);

  if (!target) {
    return (
      <div
        className="border rule bg-paper-soft p-5 flex items-center gap-4"
        data-testid="tier-progress-eminent"
      >
        <TierBadge tier={current} />
        <p className="font-editorial text-base text-gold-dark">
          Top tier reached.
        </p>
      </div>
    );
  }

  const refsPct = pct(totalRefs, target.refs_needed);
  const earnPct = pct(totalEarned, target.earnings_needed_cents);
  const refsRemaining = Math.max(0, target.refs_needed - totalRefs);
  const earnRemaining = Math.max(
    0,
    target.earnings_needed_cents - totalEarned
  );

  return (
    <div
      className="border rule bg-paper p-5 space-y-4"
      data-testid="tier-progress"
    >
      <div className="flex items-center justify-between gap-3">
        <TierBadge tier={current} />
        <span className="text-xs text-ink-soft">
          {refsRemaining > 0 && earnRemaining > 0
            ? `${refsRemaining} more refs or ${formatPrice(
                earnRemaining
              )} more earned to `
            : "Promotion to "}
          <span className="font-display uppercase tracking-[0.14em] text-gold-dark">
            {target.tier}
          </span>
        </span>
      </div>

      <div className="space-y-3">
        <Rail
          label={`${totalRefs} / ${target.refs_needed} refs`}
          ariaLabel="Referral progress to next tier"
          valueNow={Math.round(refsPct)}
          widthPct={refsPct}
        />
        <Rail
          label={`${formatPrice(totalEarned)} / ${formatPrice(
            target.earnings_needed_cents
          )} earned`}
          ariaLabel="Earnings progress to next tier"
          valueNow={Math.round(earnPct)}
          widthPct={earnPct}
        />
      </div>
    </div>
  );
}

function Rail({
  label,
  ariaLabel,
  valueNow,
  widthPct,
}: {
  label: string;
  ariaLabel: string;
  valueNow: number;
  widthPct: number;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-ink-soft">{label}</p>
      <div
        className="h-px w-full bg-paper-soft border rule overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={valueNow}
        aria-label={ariaLabel}
      >
        <div
          className={cn("h-full bg-gold transition-all duration-200 ease-out")}
          style={{ width: `${widthPct}%` }}
        />
      </div>
    </div>
  );
}

export default TierProgressBar;
