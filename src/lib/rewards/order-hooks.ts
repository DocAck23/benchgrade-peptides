/**
 * Order → rewards bridging logic.
 *
 * On `awaiting_payment → funded`, two earnings are issued:
 *   1. Own-spend points to the customer who placed the order.
 *   2. Referee-spend points (10×) + first-order bonus to the referrer
 *      whose link the order came in through, if any.
 *
 * On `funded → cancelled` or `funded → refunded`, the symmetric
 * reversal rows are inserted so tier-points and balance net to zero
 * for the cancelled order.
 *
 * Idempotency: every credit/reversal is keyed by `(source_order_id,
 * kind)`. A pre-insert check refuses to double-credit if a prior row
 * with the same key exists. Required because markOrderFunded is
 * exposed to the IPN handler AND the admin manual-mark path; either
 * could fire twice in pathological retry scenarios.
 */

import { getSupabaseServer } from "@/lib/supabase/server";
import { creditPoints, recomputeRewards } from "@/app/actions/rewards";
import {
  POINTS_BONUS_REFEREE_FIRST,
  pointsForOwnSpendCents,
  pointsForRefereeSpendCents,
} from "@/lib/rewards/tiers";
import type { PointsLedgerKind } from "@/lib/supabase/types";

interface OrderForRewards {
  order_id: string;
  customer_user_id: string | null;
  /**
   * If known at the call site (e.g. orders table eventually adds the
   * column), pass it through; otherwise we look up the referrer via
   * the referrals table from customer_user_id. Optional so callers can
   * skip the field rather than passing null repeatedly.
   */
  referrer_user_id?: string | null;
  total_cents: number | null;
  subtotal_cents: number | null;
}

/**
 * Resolve the referrer of a given customer by walking the referrals
 * table for the earliest attribution. Per PRD §4.11 the first
 * attribution is the locked one — even if the customer later uses
 * someone else's link, the original referrer keeps earning.
 */
async function lookupReferrerUserId(
  customerUserId: string,
): Promise<string | null> {
  const service = getSupabaseServer();
  if (!service) return null;
  const { data } = await service
    .from("referrals")
    .select("referrer_user_id, attributed_at")
    .eq("referee_user_id", customerUserId)
    .order("attributed_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const row = data as { referrer_user_id?: string | null } | null;
  return row?.referrer_user_id ?? null;
}

/**
 * Has a ledger row already been written for this (order, kind)?
 * Service-role read so the check sees admin-side debits / credits too.
 */
async function ledgerRowExists(
  orderId: string,
  kind: PointsLedgerKind,
): Promise<boolean> {
  const service = getSupabaseServer();
  if (!service) return false;
  const { data } = await service
    .from("points_ledger")
    .select("id")
    .eq("source_order_id", orderId)
    .eq("kind", kind)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/** Has the referrer received a first-order bonus from this referee before? */
async function refereeFirstBonusGranted(
  referrerId: string,
  refereeId: string,
): Promise<boolean> {
  const service = getSupabaseServer();
  if (!service) return false;
  const { data } = await service
    .from("points_ledger")
    .select("id")
    .eq("user_id", referrerId)
    .eq("kind", "earn_referee_first")
    .eq("source_referral_user_id", refereeId)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Award points for a freshly-funded order. Best-effort — a failure
 * here logs and returns; it MUST NOT roll back the funded status
 * transition (the order is already paid).
 *
 * Codex caught a stale-summary edge case: if a ledger row was already
 * inserted on a prior pass but the recompute didn't complete (process
 * crash, network timeout), the next idempotent retry would skip the
 * insert AND the recompute, leaving user_rewards stale until the
 * nightly cron heals it. Mitigation: track every user touched by the
 * award flow and always run recomputeRewards for each at the end —
 * recompute is idempotent so the extra call is cheap.
 */
export async function awardPointsForFundedOrder(
  order: OrderForRewards,
): Promise<void> {
  if (!order.customer_user_id) return; // guest order, no rewards account
  // Source amount: prefer total_cents (after discounts), fall back to
  // subtotal_cents. Per PRD §4.2 the rate uses post-discount, pre-
  // shipping; total_cents in this codebase is post-discount, pre-
  // shipping (shipping is added separately at fulfillment).
  const amountCents = order.total_cents ?? order.subtotal_cents ?? 0;
  if (amountCents <= 0) return;

  const touched = new Set<string>();
  touched.add(order.customer_user_id);

  // 1. Own-spend credit to the customer.
  if (!(await ledgerRowExists(order.order_id, "earn_own_spend"))) {
    const ownPoints = pointsForOwnSpendCents(amountCents);
    if (ownPoints > 0) {
      await creditPoints({
        user_id: order.customer_user_id,
        kind: "earn_own_spend",
        tier_delta: ownPoints,
        balance_delta: ownPoints,
        source_order_id: order.order_id,
      });
    }
  }

  // 2. Referrer earnings (referee-spend + optional first-order bonus).
  // Resolve the referrer from the order if the caller passed it,
  // otherwise look up the locked attribution from the referrals table.
  const referrerUserId =
    order.referrer_user_id ?? (await lookupReferrerUserId(order.customer_user_id));
  if (referrerUserId && referrerUserId !== order.customer_user_id) {
    touched.add(referrerUserId);
    if (!(await ledgerRowExists(order.order_id, "earn_referee_spend"))) {
      const referralPoints = pointsForRefereeSpendCents(amountCents);
      if (referralPoints > 0) {
        await creditPoints({
          user_id: referrerUserId,
          kind: "earn_referee_spend",
          tier_delta: referralPoints,
          balance_delta: referralPoints,
          source_order_id: order.order_id,
          source_referral_user_id: order.customer_user_id,
        });
      }
    }
    // First-order bonus, granted once per referee.
    const granted = await refereeFirstBonusGranted(
      referrerUserId,
      order.customer_user_id,
    );
    if (!granted) {
      await creditPoints({
        user_id: referrerUserId,
        kind: "earn_referee_first",
        tier_delta: POINTS_BONUS_REFEREE_FIRST,
        balance_delta: POINTS_BONUS_REFEREE_FIRST,
        source_order_id: order.order_id,
        source_referral_user_id: order.customer_user_id,
      });
    }
  }

  // Always recompute every touched user's summary. creditPoints
  // recomputes too, but only on fresh inserts; an idempotent
  // skip-then-stale-summary path would leave the user_rewards row
  // out of sync until the nightly cron. Calling recomputeRewards
  // here guarantees consistency on every retry.
  for (const userId of touched) {
    await recomputeRewards(userId);
  }
}

/**
 * On a refund or cancellation of a funded order, write a reversal
 * row that exactly negates the prior earnings. We don't try to debit
 * the redeemable balance below zero — if the customer has already
 * spent the points, the reversal still records the negative tier
 * delta (so they may drop a tier) but leaves the balance non-negative.
 *
 * Idempotency: a `reversal` row keyed to the order is inserted at
 * most once.
 */
export async function reversePointsForOrder(orderId: string): Promise<void> {
  const service = getSupabaseServer();
  if (!service) return;

  if (await ledgerRowExists(orderId, "reversal")) return;

  // Find every credit row associated with this order so we can negate
  // each in a single sweep. Includes own-spend, referee-spend, and
  // first-order bonus rows — any combination thereof.
  const { data: priorRows } = await service
    .from("points_ledger")
    .select("user_id, kind, tier_delta, balance_delta, bucket_month")
    .eq("source_order_id", orderId)
    .in("kind", [
      "earn_own_spend",
      "earn_referee_first",
      "earn_referee_spend",
    ]);
  if (!priorRows || priorRows.length === 0) return;

  // Group by user so we can clamp the per-user balance reversal to a
  // floor of -current_balance (no negative balances).
  const byUser = new Map<
    string,
    { tier: number; balance: number; bucketMonth: string }
  >();
  for (const r of priorRows as Array<{
    user_id: string;
    tier_delta: number;
    balance_delta: number;
    bucket_month: string;
  }>) {
    const cur = byUser.get(r.user_id) ?? { tier: 0, balance: 0, bucketMonth: r.bucket_month };
    cur.tier += r.tier_delta;
    cur.balance += r.balance_delta;
    byUser.set(r.user_id, cur);
  }

  for (const [userId, totals] of byUser.entries()) {
    // Pull current balance to clamp.
    const { data: rewards } = await service
      .from("user_rewards")
      .select("available_balance")
      .eq("user_id", userId)
      .maybeSingle();
    const currentBalance =
      (rewards as { available_balance?: number } | null)?.available_balance ?? 0;
    const balanceReversal = -Math.min(totals.balance, currentBalance);

    await service.from("points_ledger").insert({
      user_id: userId,
      kind: "reversal",
      tier_delta: -totals.tier,
      balance_delta: balanceReversal,
      bucket_month: totals.bucketMonth,
      source_order_id: orderId,
      note: "Order refunded / cancelled — auto reversal",
    });
    await recomputeRewards(userId);
  }
}
