import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/client";
import { getMyRewards } from "@/app/actions/rewards";
import { getMyRaffleEntries } from "@/app/actions/raffle";
import { TierLadder } from "@/components/account/TierLadder";
import { formatPrice } from "@/lib/utils";
import {
  REDEMPTION_OPTIONS,
  nextTierProgress,
  tierSpec,
} from "@/lib/rewards/tiers";
import type { PointsLedgerRow } from "@/lib/supabase/types";

export const metadata: Metadata = {
  title: "Rewards · Bench Grade Peptides",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account/rewards" },
};

const longFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const ledgerLabels: Record<string, string> = {
  earn_own_spend: "Order points",
  earn_referee_first: "First-order bonus",
  earn_referee_spend: "Referral spend",
  redeem_credit: "Store credit",
  redeem_raffle_entry: "Raffle entry",
  redeem_vial_5: "Free 5mg vial",
  redeem_vial_10: "Free 10mg vial",
  redeem_shipping: "Free shipping",
  admin_credit: "Goodwill credit",
  admin_debit: "Adjustment",
  reversal: "Reversal",
};

/**
 * /account/rewards (sprint G2). Shows the customer their tier
 * ladder, points balance, progress to next tier, redemption catalog,
 * and recent ledger history. All numbers are read-only here for the
 * launch — redemption (G4) plugs in via the catalog cards once the
 * redemption server actions are wired.
 */
export default async function RewardsPage() {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) redirect("/login?next=/account/rewards");

  // Lazy-create the user_rewards row on first visit. recomputeRewards
  // upserts based on the ledger; even a brand-new account ends up
  // with an Initiate row + 0 balance, so the page never renders an
  // empty state caused by missing data.
  const result = await getMyRewards();
  if (!result.ok) {
    return (
      <article className="space-y-8 max-w-4xl">
        <header className="space-y-2">
          <p className="font-display uppercase text-[11px] tracking-[0.18em] text-gold-dark">
            REWARDS
          </p>
          <h1
            className="font-editorial italic text-3xl lg:text-4xl text-ink leading-tight"
            style={{ fontFamily: "var(--font-editorial)" }}
          >
            Couldn&rsquo;t load your rewards.
          </h1>
        </header>
        <p className="text-sm text-ink-soft">Try again in a moment.</p>
      </article>
    );
  }

  const rewards = result.rewards ?? {
    user_id: user.id,
    tier: "initiate" as const,
    tier_points: 0,
    available_balance: 0,
    lifetime_points_earned: 0,
    referee_count: 0,
    referee_total_spend_cents: 0,
    free_shipping_until: null,
    recomputed_at: new Date().toISOString(),
  };

  const progress = nextTierProgress(rewards.tier_points);
  const current = tierSpec(rewards.tier);

  // Live raffle-entries for this month + the configured prize.
  // Best-effort: a failure here doesn't break the rewards page,
  // we just hide the raffle card.
  const raffle = await getMyRaffleEntries().catch(() => null);

  // Recent ledger — last 25 entries. RLS scopes to the caller; the
  // `source_referral_user_id` column is exposed on read-own-rows
  // (acknowledged tradeoff: a referee can see their referrer's user
  // id by reading their own ledger row). G4 may add a redacted view
  // if this becomes a privacy concern.
  const { data: ledgerRows } = await supa
    .from("points_ledger")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(25);
  const ledger = (ledgerRows ?? []) as PointsLedgerRow[];

  return (
    <article className="space-y-8 max-w-4xl">
      <header className="space-y-2">
        <p className="font-display uppercase text-[11px] tracking-[0.18em] text-gold-dark">
          REWARDS
        </p>
        <h1
          className="font-editorial italic text-3xl lg:text-4xl text-ink leading-tight"
          style={{ fontFamily: "var(--font-editorial)" }}
        >
          Earn the bench.
        </h1>
        <p className="text-sm text-ink-soft max-w-prose">
          Every dollar you spend or refer earns points. Points climb you the
          ladder and stack into the monthly raffle.
        </p>
      </header>

      <TierLadder
        currentTier={rewards.tier}
        currentPoints={rewards.tier_points}
      />

      {/* Progress + balance summary */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rule bg-paper p-5">
          <div className="label-eyebrow text-ink-muted mb-1">Available</div>
          <div className="font-mono-data text-3xl text-ink leading-none">
            {rewards.available_balance.toLocaleString()}
          </div>
          <div className="text-xs text-ink-muted mt-2">
            redeemable points
          </div>
        </div>
        <div className="border rule bg-paper p-5">
          <div className="label-eyebrow text-ink-muted mb-1">Lifetime earned</div>
          <div className="font-mono-data text-3xl text-ink leading-none">
            {rewards.lifetime_points_earned.toLocaleString()}
          </div>
          <div className="text-xs text-ink-muted mt-2">
            since you joined
          </div>
        </div>
        <div className="border rule bg-paper p-5">
          <div className="label-eyebrow text-ink-muted mb-1">Next tier</div>
          {progress ? (
            <>
              <div className="font-display text-base text-ink">
                {progress.next.label}
              </div>
              <div className="font-mono-data text-2xl text-ink mt-1 leading-none">
                {progress.pointsNeeded.toLocaleString()}
              </div>
              <div className="text-xs text-ink-muted mt-2">
                points to climb
              </div>
            </>
          ) : (
            <>
              <div className="font-display text-base text-ink">Top tier</div>
              <div className="text-xs text-ink-muted mt-2">
                You&rsquo;re a {current.label}. Nowhere left to climb — keep
                stacking the raffle entries.
              </div>
            </>
          )}
        </div>
      </section>

      {/* Monthly raffle widget — shows live entry count, the
          breakdown by source (tier base + own spend + referee
          spend), and the prize the founder configured for this
          month. Empty admin config falls back to a placeholder
          message so the customer always sees the section. */}
      {raffle && raffle.ok && (
        <section className="border-2 border-wine bg-wine/5 p-5 sm:p-6 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <div>
              <div className="label-eyebrow text-wine font-bold mb-1">
                Monthly raffle
              </div>
              <h2 className="font-display text-2xl text-ink">
                {raffle.entry_count.toLocaleString()} entr
                {raffle.entry_count === 1 ? "y" : "ies"} this month
              </h2>
            </div>
            {raffle.prize ? (
              <div className="text-right">
                <div className="label-eyebrow text-ink-muted">This month&rsquo;s prize</div>
                <div className="font-display text-base text-ink mt-1">
                  {raffle.prize.kind === "cash"
                    ? raffle.prize.amount_cents
                      ? `${formatPrice(raffle.prize.amount_cents)} cash`
                      : "Cash prize"
                    : "2 free vials of choice"}
                </div>
              </div>
            ) : (
              <div className="text-xs text-ink-muted text-right max-w-[200px]">
                Prize for this month is being configured.
              </div>
            )}
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-ink-soft">
            <li className="border rule bg-paper p-3">
              <span className="font-mono-data text-ink">
                {raffle.base_from_tier}
              </span>{" "}
              from your tier
            </li>
            <li className="border rule bg-paper p-3">
              <span className="font-mono-data text-ink">
                {raffle.from_own_spend}
              </span>{" "}
              from your spend ($25 / entry)
            </li>
            <li className="border rule bg-paper p-3">
              <span className="font-mono-data text-ink">
                {raffle.from_referee_spend}
              </span>{" "}
              from referee spend ($10 / entry)
            </li>
          </ul>
          <p className="text-xs text-ink-muted">
            Drawn on the 1st of next month. Winners are emailed within 24
            hours of the founder confirming the draw.
          </p>
        </section>
      )}

      {/* Earning rates explainer */}
      <section className="border rule bg-paper-soft p-5 sm:p-6 space-y-3">
        <div className="label-eyebrow text-ink-muted">How you earn</div>
        <ul className="text-sm text-ink-soft space-y-1.5">
          <li>
            <span className="font-mono-data text-ink">1 pt</span> per $1 of your
            own spend
          </li>
          <li>
            <span className="font-mono-data text-ink">10 pts</span> per $1 your
            referrals spend (lifetime, every order)
          </li>
          <li>
            <span className="font-mono-data text-ink">+100 pts</span> bonus the
            first time someone uses your referral link
          </li>
          <li className="text-ink-muted text-xs pt-2">
            Points roll off after 12 months of inactivity. Spending points
            never drops your tier.
          </li>
        </ul>
      </section>

      {/* Redemption catalog */}
      <section className="space-y-4">
        <h2 className="font-display uppercase text-[12px] tracking-[0.18em] text-ink">
          Redeem
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {REDEMPTION_OPTIONS.map((opt) => {
            const affordable = rewards.available_balance >= opt.cost;
            return (
              <div
                key={opt.kind}
                className={`border rule p-4 sm:p-5 flex items-start justify-between gap-4 ${
                  affordable ? "bg-paper" : "bg-paper-soft"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-display text-ink">{opt.label}</div>
                  <p className="text-xs text-ink-soft mt-1 leading-relaxed">
                    {opt.description}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono-data text-sm text-ink">
                    {opt.cost.toLocaleString()} pts
                  </div>
                  <div className="text-[10px] text-ink-muted mt-1 uppercase tracking-[0.1em]">
                    {affordable ? "available" : "soon"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-ink-muted">
          Redemption goes live with sprint G4 — for now this is a preview of
          what your points will unlock.
        </p>
      </section>

      {/* Recent ledger */}
      <section className="space-y-4">
        <h2 className="font-display uppercase text-[12px] tracking-[0.18em] text-ink">
          Recent activity
        </h2>
        {ledger.length === 0 ? (
          <p className="text-sm text-ink-muted border rule bg-paper-soft p-5">
            No activity yet. Place your first order to start earning.
          </p>
        ) : (
          <div className="border rule bg-paper">
            <ul className="divide-y rule">
              {ledger.map((row) => {
                const sign = row.balance_delta >= 0 ? "+" : "−";
                const abs = Math.abs(row.balance_delta);
                return (
                  <li
                    key={row.id}
                    className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-ink">
                        {ledgerLabels[row.kind] ?? row.kind}
                      </div>
                      <div className="font-mono-data text-[11px] text-ink-muted">
                        {longFormatter.format(new Date(row.created_at))}
                        {row.source_order_id ? (
                          <>
                            {" · "}
                            BGP-
                            {row.source_order_id.slice(0, 8).toUpperCase()}
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div
                      className={`font-mono-data text-sm shrink-0 ${
                        row.balance_delta >= 0 ? "text-ink" : "text-ink-muted"
                      }`}
                    >
                      {sign}
                      {abs.toLocaleString()} pts
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </article>
  );
}
