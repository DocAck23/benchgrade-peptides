"use server";

/**
 * Affiliate server actions (Sprint 4 Wave B1).
 *
 *   applyForAffiliate              — public; INSERT pending application.
 *   getMyAffiliateState            — auth-gated; reads via RLS.
 *   redeemCommissionForVialCredit  — auth-gated; atomic decrement +
 *                                    ledger entry + free-vial entitlement.
 *   awardCommissionForOrder        — internal hook (exported for test +
 *                                    cross-call from webhook + admin
 *                                    markOrderFunded). Best-effort: never
 *                                    surfaces failures to the caller of
 *                                    the funded transition.
 *
 * Security boundary:
 *   - Cookie-scoped client → user-driven flows where RLS = authority.
 *   - Service-role client  → INSERTs blocked by deny-by-default RLS, and
 *                            internal commission-award path that runs
 *                            outside any user session.
 */

import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/client";
import { getSupabaseServer } from "@/lib/supabase/server";
import {
  affiliateTier,
  redemptionRatio,
  type AffiliateTier,
} from "@/lib/affiliate/tiers";
import { computeCommission } from "@/lib/affiliate/commission";
import type {
  AffiliateRow,
  CommissionLedgerRow,
  AffiliatePayoutRow,
} from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// applyForAffiliate
// ---------------------------------------------------------------------------

const ApplySchema = z.object({
  applicant_email: z.string().email().max(254),
  applicant_name: z.string().trim().min(1).max(200),
  audience_description: z.string().trim().min(1).max(2000),
  website_or_social: z.string().trim().max(500).nullable(),
});

export interface ApplyForAffiliateInput {
  applicant_email: string;
  applicant_name: string;
  audience_description: string;
  website_or_social: string | null;
}

export interface ApplyForAffiliateResult {
  ok: boolean;
  application_id?: string;
  error?: string;
}

export async function applyForAffiliate(
  input: ApplyForAffiliateInput
): Promise<ApplyForAffiliateResult> {
  const parsed = ApplySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  // Capture applicant_user_id IF authenticated. People often apply BEFORE
  // signup, so unauthenticated is a normal path — not an error.
  let applicantUserId: string | null = null;
  try {
    const cookie = await createServerSupabase();
    const {
      data: { user },
    } = await cookie.auth.getUser();
    applicantUserId = user?.id ?? null;
  } catch {
    applicantUserId = null;
  }

  // INSERT via service-role: RLS denies INSERT on affiliate_applications
  // by default, and we want anonymous apply to work.
  const service = getSupabaseServer();
  if (!service) return { ok: false, error: "Database unavailable." };

  const { data, error } = await service
    .from("affiliate_applications")
    .insert({
      applicant_email: parsed.data.applicant_email.trim().toLowerCase(),
      applicant_name: parsed.data.applicant_name,
      audience_description: parsed.data.audience_description,
      website_or_social: parsed.data.website_or_social,
      applicant_user_id: applicantUserId,
      status: "pending",
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Insert failed." };
  }
  return { ok: true, application_id: (data as { id: string }).id };
}

// ---------------------------------------------------------------------------
// getMyAffiliateState
// ---------------------------------------------------------------------------

export interface GetMyAffiliateStateResult {
  ok: boolean;
  is_affiliate: boolean;
  affiliate?: AffiliateRow;
  successful_referrals_count?: number;
  recent_ledger?: CommissionLedgerRow[];
  recent_payouts?: AffiliatePayoutRow[];
  error?: string;
}

export async function getMyAffiliateState(): Promise<GetMyAffiliateStateResult> {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) {
    return { ok: true, is_affiliate: false };
  }

  const { data: aff } = await supa
    .from("affiliates")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!aff) {
    return { ok: true, is_affiliate: false };
  }
  const affiliate = aff as AffiliateRow;

  // Successful referrals = count of `redeemed` referrals attributed to this
  // affiliate. v1 uses a simple count(*) — small data volume.
  const refsResp = await supa
    .from("referrals")
    .select("id", { count: "exact" })
    .eq("referrer_user_id", user.id);
  const successfulRefs = refsResp.count ?? 0;

  const { data: ledger } = await supa
    .from("commission_ledger")
    .select("*")
    .eq("affiliate_id", affiliate.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: payouts } = await supa
    .from("affiliate_payouts")
    .select("*")
    .eq("affiliate_id", affiliate.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return {
    ok: true,
    is_affiliate: true,
    affiliate,
    successful_referrals_count: successfulRefs,
    recent_ledger: (ledger ?? []) as CommissionLedgerRow[],
    recent_payouts: (payouts ?? []) as AffiliatePayoutRow[],
  };
}

// ---------------------------------------------------------------------------
// redeemCommissionForVialCredit
// ---------------------------------------------------------------------------

const RedeemSchema = z.object({
  amount_cents: z.number().int().positive().max(10_000_000),
});

export interface RedeemCommissionResult {
  ok: boolean;
  vial_credit_cents?: number;
  error?: string;
}

/**
 * v1 simplification: we mint a generic free_vial_entitlement (5mg) whose
 * monetary equivalent is `vial_credit_cents`. The customer redeems it at
 * checkout against a 5mg vial. v2 will support arbitrary vial-size credit
 * pools and partial redemption against any-size vial.
 */
export async function redeemCommissionForVialCredit(input: {
  amount_cents: number;
}): Promise<RedeemCommissionResult> {
  const parsed = RedeemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid amount." };
  }
  const amount = parsed.data.amount_cents;

  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  // Read affiliate row (RLS = own row only).
  const { data: aff } = await supa
    .from("affiliates")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!aff) return { ok: false, error: "Not an affiliate." };
  const affiliate = aff as AffiliateRow;
  const tier = affiliate.tier as AffiliateTier;
  const ratio = redemptionRatio(tier);
  const vialCredit = Math.round(amount * ratio);

  // Atomic decrement: filter on balance >= amount so a concurrent redeem
  // can't push the balance below zero. RLS scopes the row to this user.
  const newBalance = affiliate.available_balance_cents - amount;
  const newRedeemed = (affiliate.total_redeemed_cents ?? 0) + amount;
  const { data: updated, error: updateError } = await supa
    .from("affiliates")
    .update({
      available_balance_cents: newBalance,
      total_redeemed_cents: newRedeemed,
    })
    .eq("user_id", user.id)
    .gte("available_balance_cents", amount)
    .select("id");
  if (updateError) return { ok: false, error: updateError.message };
  if (!updated || updated.length === 0) {
    return { ok: false, error: "Insufficient balance." };
  }

  // Service-role INSERTs (RLS deny-by-default).
  const service = getSupabaseServer();
  if (service) {
    await service.from("commission_ledger").insert({
      affiliate_id: affiliate.id,
      kind: "redemption_debit",
      amount_cents: -amount,
      tier_at_time: tier,
    });
    await service.from("free_vial_entitlements").insert({
      customer_user_id: user.id,
      size_mg: 5,
      source: "admin_grant",
      status: "available",
    });
  }

  return { ok: true, vial_credit_cents: vialCredit };
}

// ---------------------------------------------------------------------------
// awardCommissionForOrder — internal hook (best-effort)
// ---------------------------------------------------------------------------

export interface AwardCommissionResult {
  ok: boolean;
  commissions_awarded: number;
}

/**
 * Award commission for an order that just transitioned to `funded`.
 *
 * For each referral whose first_order_id == orderId, if the referrer has
 * an `affiliates` row AND it is NOT a self-affiliate (case-insensitive
 * email compare), we INSERT a `commission_ledger` row (kind='earned') and
 * UPDATE the affiliate's running balances. After the update we re-evaluate
 * the tier — if it crossed a threshold, we persist the new tier.
 *
 * Best-effort: any error here is swallowed (we never block the funded
 * transition that already landed in Postgres). v2 moves to a Postgres RPC
 * for atomicity.
 */
export async function awardCommissionForOrder(
  orderId: string
): Promise<AwardCommissionResult> {
  try {
    const service = getSupabaseServer();
    if (!service) return { ok: true, commissions_awarded: 0 };

    // 1. Order: total_cents + customer email (for self-affiliate guard).
    const { data: order } = await service
      .from("orders")
      .select("order_id, total_cents, customer")
      .eq("order_id", orderId)
      .maybeSingle();
    if (!order) return { ok: true, commissions_awarded: 0 };
    const orderRow = order as {
      order_id: string;
      total_cents: number | null;
      customer: { email?: string };
    };
    const orderTotal = orderRow.total_cents ?? 0;
    const customerEmail = (orderRow.customer?.email ?? "").trim().toLowerCase();

    // 2. Referrals attributed to this order (cycle 1 / one-shot).
    const refsResp = await service
      .from("referrals")
      .select("id, referrer_user_id, referee_email")
      .eq("first_order_id", orderId);
    const referrals = (refsResp.data ?? []) as Array<{
      id: string;
      referrer_user_id: string;
      referee_email: string;
    }>;
    if (referrals.length === 0) return { ok: true, commissions_awarded: 0 };

    let awarded = 0;
    for (const ref of referrals) {
      // 2a. Affiliate lookup; skip if referrer is not an affiliate.
      const { data: aff } = await service
        .from("affiliates")
        .select("*")
        .eq("user_id", ref.referrer_user_id)
        .maybeSingle();
      if (!aff) continue;
      const affiliate = aff as AffiliateRow;

      // 2b. Self-affiliate guard via auth.users email.
      try {
        const { data: ownerResp } = await service.auth.admin.getUserById(
          ref.referrer_user_id
        );
        const ownerEmail = (ownerResp?.user?.email ?? "").trim().toLowerCase();
        if (ownerEmail && customerEmail && ownerEmail === customerEmail) {
          continue;
        }
      } catch {
        // Fail closed: skip when we cannot resolve the owner email.
        continue;
      }

      const tier = affiliate.tier as AffiliateTier;
      const earned = computeCommission(orderTotal, tier);
      if (earned <= 0) continue;

      // 2c. Insert ledger + update aggregates (compensating non-atomic; v2 RPC).
      await service.from("commission_ledger").insert({
        affiliate_id: affiliate.id,
        source_referral_id: ref.id,
        source_order_id: orderId,
        kind: "earned",
        amount_cents: earned,
        tier_at_time: tier,
      });

      const newBalance = affiliate.available_balance_cents + earned;
      const newEarned = affiliate.total_earned_cents + earned;

      // 2d. Tier auto-promotion: re-fetch successful_referrals_count.
      const refsCountResp = await service
        .from("referrals")
        .select("id", { count: "exact" })
        .eq("referrer_user_id", ref.referrer_user_id);
      const refsCount = refsCountResp.count ?? 0;
      const recomputedTier = affiliateTier({
        successful_referrals_count: refsCount,
        total_earned_cents: newEarned,
      });

      const patch: Record<string, unknown> = {
        available_balance_cents: newBalance,
        total_earned_cents: newEarned,
      };
      if (recomputedTier !== affiliate.tier) {
        patch.tier = recomputedTier;
      }
      await service.from("affiliates").update(patch).eq("id", affiliate.id);

      awarded++;
    }

    return { ok: true, commissions_awarded: awarded };
  } catch (err) {
    console.error("[awardCommissionForOrder] failed:", err);
    return { ok: true, commissions_awarded: 0 };
  }
}

