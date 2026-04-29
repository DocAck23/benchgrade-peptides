"use server";

/**
 * Rewards / tier ledger actions (sprint G1).
 *
 * Two writers (`creditPoints`, `debitPoints`) and one reconciler
 * (`recomputeRewards`). Every write goes via the service-role client
 * because RLS blocks customer-side INSERTs on points_ledger and
 * user_rewards — the action layer is the security boundary.
 *
 * Crediting flow:
 *   1. Insert a points_ledger row for the audit trail.
 *   2. Recompute the user_rewards summary from the ledger so the
 *      denormalized view reflects the new state.
 *
 * Recompute is the single source of truth for tier_points (rolling
 * 12-month window) and available_balance (lifetime sum). Doing it on
 * every write keeps the UI consistent without polling — the nightly
 * cron only catches the rollover transitions that happen at
 * month-start without any other ledger activity.
 *
 * Order-funded / order-cancelled hooks call into here from
 * orders.ts; admin tools call directly from the customer detail page.
 */

import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { tierFromPoints, tierSpec, TIER_SPECS } from "@/lib/rewards/tiers";
import { SITE_URL } from "@/lib/site";
import { sendTierUp } from "@/lib/email/notifications/send-rewards-emails";
import type {
  PointsLedgerKind,
  RewardTier,
  UserRewardsRow,
} from "@/lib/supabase/types";

// ---------- Constants ----------

/**
 * The rolling window length for tier-points decay (PRD §4.3).
 * Exposed as a constant so the SQL aggregation and the UI agree on
 * the cutoff without hardcoding the same magic in two places.
 */
const TIER_WINDOW_MONTHS = 12;

// ---------- Validation ----------

const UuidSchema = z.string().uuid("Invalid user id.");

const KindSchema = z.enum([
  "earn_own_spend",
  "earn_referee_first",
  "earn_referee_spend",
  "redeem_credit",
  "redeem_raffle_entry",
  "redeem_vial_5",
  "redeem_vial_10",
  "redeem_shipping",
  "admin_credit",
  "admin_debit",
  "reversal",
]) satisfies z.ZodType<PointsLedgerKind>;

const CreditInput = z.object({
  user_id: UuidSchema,
  kind: KindSchema,
  /** Positive integer. Sign is determined by the action (credit vs debit). */
  tier_delta: z.number().int().min(0).max(1_000_000),
  balance_delta: z.number().int().min(0).max(1_000_000),
  /** Optional override; defaults to current month (UTC). */
  bucket_month: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/u, "bucket_month must be YYYY-MM-DD")
    .optional(),
  source_order_id: z.string().max(80).optional().nullable(),
  source_referral_user_id: UuidSchema.optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

export type CreditInput = z.infer<typeof CreditInput>;

const DebitInput = z.object({
  user_id: UuidSchema,
  kind: KindSchema,
  /** Always positive — the action negates internally. */
  balance_delta: z.number().int().min(1).max(1_000_000),
  /** Spending never affects tier-points (PRD §4.3); kept here so admin
   *  debits / reversals can clear tier-points when needed. */
  tier_delta: z.number().int().min(0).max(1_000_000).default(0),
  source_order_id: z.string().max(80).optional().nullable(),
  source_referral_user_id: UuidSchema.optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

export type DebitInput = z.infer<typeof DebitInput>;

// ---------- Helpers ----------

/** First-of-month (UTC) as a YYYY-MM-DD string. */
function currentBucketMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

/**
 * Cutoff for the rolling tier-points window. Returned as a
 * YYYY-MM-DD string of the first-of-month TIER_WINDOW_MONTHS ago.
 * A bucket_month >= cutoff contributes to tier-points.
 */
function tierWindowCutoff(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  // Anchor on the first of *this* month then back up by N months.
  const m = now.getUTCMonth() - TIER_WINDOW_MONTHS + 1;
  const date = new Date(Date.UTC(y, m, 1));
  const yy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}-01`;
}

// ---------- Public actions ----------

export interface RewardsActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Append a positive ledger row and recompute the user's rewards
 * summary. Idempotency is the caller's responsibility — for order
 * earnings, callers should check that no prior row exists for
 * `(source_order_id, kind)` before invoking.
 */
export async function creditPoints(input: CreditInput): Promise<RewardsActionResult> {
  const parsed = CreditInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;
  if (v.tier_delta === 0 && v.balance_delta === 0) {
    return { ok: false, error: "Empty credit (both deltas zero)." };
  }

  const service = getSupabaseServer();
  if (!service) return { ok: false, error: "Database unavailable." };

  const { error: insertErr } = await service.from("points_ledger").insert({
    user_id: v.user_id,
    kind: v.kind,
    tier_delta: v.tier_delta,
    balance_delta: v.balance_delta,
    bucket_month: v.bucket_month ?? currentBucketMonth(),
    source_order_id: v.source_order_id ?? null,
    source_referral_user_id: v.source_referral_user_id ?? null,
    note: v.note ?? null,
  });
  if (insertErr) {
    console.error("[creditPoints] insert failed:", insertErr);
    return { ok: false, error: "Could not record credit." };
  }

  const recomputed = await recomputeRewards(v.user_id);
  if (!recomputed.ok) return recomputed;
  return { ok: true };
}

/**
 * Append a negative ledger row and recompute. Tier-points debits are
 * uncommon (only admin claw-backs and reversals); the default keeps
 * tier untouched.
 *
 * Atomicity: routed through the `points_ledger_atomic_debit` RPC
 * which performs the balance aggregate + insert under a row lock on
 * `user_rewards` — concurrent debits serialize and the second one
 * reads the post-debit balance, eliminating the over-spend window
 * that a JS-level check + insert would leave open. The RPC returns
 * NULL when funds are insufficient; we surface that as "not enough
 * points" without leaking ledger internals.
 */
export async function debitPoints(input: DebitInput): Promise<RewardsActionResult> {
  const parsed = DebitInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;

  const service = getSupabaseServer();
  if (!service) return { ok: false, error: "Database unavailable." };

  const { data: rpcResult, error: rpcErr } = await service.rpc(
    "points_ledger_atomic_debit",
    {
      p_user_id: v.user_id,
      p_kind: v.kind,
      p_balance_delta: v.balance_delta,
      p_tier_delta: v.tier_delta,
      p_bucket_month: currentBucketMonth(),
      p_source_order_id: v.source_order_id ?? null,
      p_source_referral_user_id: v.source_referral_user_id ?? null,
      p_note: v.note ?? null,
    },
  );
  if (rpcErr) {
    console.error("[debitPoints] rpc failed:", rpcErr);
    return { ok: false, error: "Could not record debit." };
  }
  if (!rpcResult) {
    return { ok: false, error: "Not enough points." };
  }

  const recomputed = await recomputeRewards(v.user_id);
  if (!recomputed.ok) return recomputed;
  return { ok: true };
}

interface AggregateRow {
  tier_points: number;
  available_balance: number;
  lifetime_points_earned: number;
}

/**
 * Recompute a single user's rewards summary from the ledger and
 * upsert into user_rewards. Called from credit/debit actions on
 * every write, and by the nightly cron for time-driven rollovers.
 */
export async function recomputeRewards(userId: string): Promise<RewardsActionResult> {
  const parsed = UuidSchema.safeParse(userId);
  if (!parsed.success) {
    return { ok: false, error: "Invalid user id." };
  }

  const service = getSupabaseServer();
  if (!service) return { ok: false, error: "Database unavailable." };

  const cutoff = tierWindowCutoff();

  // Tier-points: sum of tier_delta over the rolling window.
  const { data: tierRows, error: tierErr } = await service
    .from("points_ledger")
    .select("tier_delta")
    .eq("user_id", userId)
    .gte("bucket_month", cutoff);
  if (tierErr) {
    console.error("[recomputeRewards] tier window read failed:", tierErr);
    return { ok: false, error: "Recompute failed." };
  }
  const tierPoints = (tierRows ?? []).reduce(
    (sum, r) => sum + ((r as { tier_delta: number }).tier_delta ?? 0),
    0,
  );

  // Available balance: sum of balance_delta over all time.
  const { data: balRows, error: balErr } = await service
    .from("points_ledger")
    .select("balance_delta, tier_delta")
    .eq("user_id", userId);
  if (balErr) {
    console.error("[recomputeRewards] full ledger read failed:", balErr);
    return { ok: false, error: "Recompute failed." };
  }
  const aggregates: AggregateRow = (balRows ?? []).reduce<AggregateRow>(
    (acc, r) => {
      const row = r as { balance_delta: number; tier_delta: number };
      acc.available_balance += row.balance_delta;
      // Lifetime never decays — count only positive tier credits as
      // the "lifetime points earned" metric (negative reversals/debits
      // don't reduce it).
      if (row.tier_delta > 0) acc.lifetime_points_earned += row.tier_delta;
      return acc;
    },
    { tier_points: tierPoints, available_balance: 0, lifetime_points_earned: 0 },
  );

  const tier: RewardTier = tierFromPoints(Math.max(0, tierPoints));

  // Cached referral metrics — count distinct referees who placed a
  // funded order + their lifetime spend. We resolve referees via the
  // referrals table (referrer_user_id = userId), then sum funded
  // orders on each referee. Two-step because the orders table has no
  // referrer_user_id column today.
  let refereeCount = 0;
  let refereeTotalSpendCents = 0;
  try {
    const { data: refRows } = await service
      .from("referrals")
      .select("referee_user_id")
      .eq("referrer_user_id", userId);
    const refereeIds = Array.from(
      new Set(
        (refRows as Array<{ referee_user_id: string | null }> | null)
          ?.map((r) => r.referee_user_id)
          .filter((v): v is string => Boolean(v)) ?? [],
      ),
    );
    if (refereeIds.length > 0) {
      const { data: refOrders } = await service
        .from("orders")
        .select("customer_user_id, total_cents")
        .in("customer_user_id", refereeIds)
        .eq("status", "funded");
      if (Array.isArray(refOrders)) {
        const seen = new Set<string>();
        for (const o of refOrders as Array<{
          customer_user_id: string | null;
          total_cents: number | null;
        }>) {
          if (o.customer_user_id) seen.add(o.customer_user_id);
          if (typeof o.total_cents === "number")
            refereeTotalSpendCents += o.total_cents;
        }
        refereeCount = seen.size;
      }
    }
  } catch (refErr) {
    console.error("[recomputeRewards] referee aggregate failed:", refErr);
    // Non-fatal: leave at zero so the recompute still updates points.
  }

  // Read the prior tier (if any) so we can detect a cross-up
  // transition AFTER the upsert lands. Two-step to keep the
  // tier-up email idempotent: it fires only when the prior tier
  // existed and the new tier is strictly higher.
  const { data: prior } = await service
    .from("user_rewards")
    .select("tier")
    .eq("user_id", userId)
    .maybeSingle();
  const priorTier = (prior as { tier?: RewardTier } | null)?.tier ?? null;

  const { error: upsertErr } = await service.from("user_rewards").upsert(
    {
      user_id: userId,
      tier,
      tier_points: Math.max(0, tierPoints),
      available_balance: aggregates.available_balance,
      lifetime_points_earned: aggregates.lifetime_points_earned,
      referee_count: refereeCount,
      referee_total_spend_cents: refereeTotalSpendCents,
    },
    { onConflict: "user_id" },
  );
  if (upsertErr) {
    console.error("[recomputeRewards] upsert failed:", upsertErr);
    return { ok: false, error: "Recompute failed." };
  }

  // Tier-up email — best-effort, fires only on a true cross-up
  // (priorTier defined and below the new tier in the ladder). Sent
  // via service-role auth admin getUserById to look up the email
  // off auth.users; we don't store email on user_rewards directly.
  if (priorTier && priorTier !== tier) {
    const priorIdx = TIER_SPECS.findIndex((s) => s.tier === priorTier);
    const newIdx = TIER_SPECS.findIndex((s) => s.tier === tier);
    if (newIdx > priorIdx) {
      try {
        const { data: userResp } = await service.auth.admin.getUserById(userId);
        const email = userResp?.user?.email ?? null;
        if (email) {
          const meta = userResp?.user?.user_metadata as
            | { first_name?: string; last_name?: string }
            | undefined;
          const firstName = meta?.first_name ?? email.split("@")[0];
          const spec = tierSpec(tier);
          await sendTierUp(email, {
            customer_name: firstName,
            new_tier_label: spec.label,
            own_discount_pct: spec.ownDiscountPct,
            referral_link_pct: spec.referralLinkPct,
            rewards_url: `${SITE_URL}/account/rewards`,
          });
        }
      } catch (emailErr) {
        console.error("[recomputeRewards] tier-up email failed:", emailErr);
      }
    }
  }

  return { ok: true };
}

/**
 * Convenience read for surfaces that want the customer's current
 * rewards state. Cookie-scoped so RLS pins to the caller; admin
 * surfaces use the service-role client directly.
 */
export async function getMyRewards(): Promise<{
  ok: boolean;
  rewards?: UserRewardsRow;
  error?: string;
}> {
  const { createServerSupabase } = await import("@/lib/supabase/client");
  const cookie = await createServerSupabase();
  const {
    data: { user },
  } = await cookie.auth.getUser();
  if (!user) return { ok: false, error: "Not authenticated." };
  const { data, error } = await cookie
    .from("user_rewards")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) {
    console.error("[getMyRewards] read failed:", error);
    return { ok: false, error: "Could not load rewards." };
  }
  return { ok: true, rewards: (data as UserRewardsRow | null) ?? undefined };
}

// ---------- Admin actions ----------

/**
 * Admin adjustment guardrail. Codex review flagged a 1M cap as too
 * permissive — a single mistyped "10000" → "1000000" would catapult
 * a customer past Laureate (15,000) sixty-six times over. 10,000
 * keeps a fat-finger contained while still covering legitimate
 * goodwill grants and reversal claw-backs. Genuinely larger
 * adjustments require a follow-up call (split into multiple grants
 * with paper-trail notes — admin trail is the audit mechanism).
 */
const ADMIN_DELTA_CAP = 10_000;

const AdminAdjustInput = z.object({
  user_id: UuidSchema,
  /** Always positive — sign is determined by the kind. */
  tier_delta: z.number().int().min(0).max(ADMIN_DELTA_CAP),
  balance_delta: z.number().int().min(0).max(ADMIN_DELTA_CAP),
  /** Required: every admin adjustment must carry a reason. */
  note: z.string().trim().min(1, "Reason is required.").max(500),
});

/**
 * Admin manual credit. Both tier and balance accept the same
 * positive delta — admin can grant a goodwill credit, comp a
 * referrer who didn't get auto-attributed, etc. RLS isn't enough
 * here because admin actions run via service-role; the action is
 * gated on isAdmin() at the call site.
 */
export async function adminCreditPoints(
  input: z.infer<typeof AdminAdjustInput>,
  isAdminCheck: () => Promise<boolean>,
): Promise<RewardsActionResult> {
  if (!(await isAdminCheck())) return { ok: false, error: "Unauthorized." };
  const parsed = AdminAdjustInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;
  return creditPoints({
    user_id: v.user_id,
    kind: "admin_credit",
    tier_delta: v.tier_delta,
    balance_delta: v.balance_delta,
    note: v.note,
  });
}

/**
 * Admin manual debit / claw-back. Same shape as credit; deltas are
 * positive but the kind tags the row as a debit so the UI ledger
 * shows it correctly.
 */
export async function adminDebitPoints(
  input: z.infer<typeof AdminAdjustInput>,
  isAdminCheck: () => Promise<boolean>,
): Promise<RewardsActionResult> {
  if (!(await isAdminCheck())) return { ok: false, error: "Unauthorized." };
  const parsed = AdminAdjustInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const v = parsed.data;
  return debitPoints({
    user_id: v.user_id,
    kind: "admin_debit",
    tier_delta: v.tier_delta,
    balance_delta: v.balance_delta,
    note: v.note,
  });
}
