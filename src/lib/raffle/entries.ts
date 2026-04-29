import { tierSpec } from "@/lib/rewards/tiers";
import type { RewardTier } from "@/lib/supabase/types";

/**
 * Per-customer raffle entry computation (PRD §4.8):
 *
 *   entries = base(tier)
 *           + floor(own_funded_spend_this_month_cents / 2500)
 *           + floor(referee_funded_spend_this_month_cents / 1000)
 *
 * Base count comes from TIER_SPECS. Spend is *funded* spend in the
 * calendar month (UTC) — the cron snapshots on the last day, so a
 * funded order placed at 23:59:59 still counts.
 *
 * The referee multiplier is 2.5× harder per dollar than own spend
 * ($10 per entry vs $25 per entry) — same philosophy as the 10×
 * points multiplier on referrals. This is the lever that makes
 * referring the dominant climbing path inside the raffle pool too.
 */

const OWN_SPEND_CENTS_PER_ENTRY = 2500; // $25
const REFEREE_SPEND_CENTS_PER_ENTRY = 1000; // $10

export function computeRaffleEntries(args: {
  tier: RewardTier;
  ownSpendCentsThisMonth: number;
  refereeSpendCentsThisMonth: number;
}): number {
  const base = tierSpec(args.tier).baseRaffleEntries;
  const safeOwn = Number.isFinite(args.ownSpendCentsThisMonth)
    ? args.ownSpendCentsThisMonth
    : 0;
  const safeRef = Number.isFinite(args.refereeSpendCentsThisMonth)
    ? args.refereeSpendCentsThisMonth
    : 0;
  const own = Math.max(0, Math.floor(safeOwn / OWN_SPEND_CENTS_PER_ENTRY));
  const ref = Math.max(
    0,
    Math.floor(safeRef / REFEREE_SPEND_CENTS_PER_ENTRY),
  );
  return base + own + ref;
}

/**
 * First-of-month UTC date for a given moment. Used as the canonical
 * `month` PK on `raffle_months` and as the start-of-window cutoff
 * when summing in-month spend.
 */
export function startOfMonthUtc(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
}

/**
 * First-of-NEXT-month UTC date. Used as the exclusive upper bound
 * when summing spend that fell inside the current calendar month.
 */
export function startOfNextMonthUtc(now = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
}

/**
 * Format a Date as 'YYYY-MM-01' for the raffle_months PK.
 */
export function monthKey(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}
