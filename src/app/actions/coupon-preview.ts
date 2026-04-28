"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createServerSupabase } from "@/lib/supabase/client";
import { applyCoupon, validateCouponSync } from "@/lib/coupons/apply";
import { resolveClientIp } from "@/lib/ratelimit/ip";
import { checkAndIncrement } from "@/lib/ratelimit/window";
import { SupabaseRateLimitStore } from "@/lib/ratelimit/supabase-store";
import { MemoryRateLimitStore } from "@/lib/ratelimit/memory-store";
import type {
  CouponRecord,
  CouponValidationFailure,
} from "@/lib/coupons/types";

// Coupon-preview is an unauthenticated oracle (codex review #3).
// Without rate limiting it can be used to enumerate the coupon table,
// observe per-email cap state, and probe expiry windows. 30 attempts
// per IP per 5 minutes is plenty for legit "type → check" cycles.
const PREVIEW_RATE_LIMIT = { limit: 30, windowSeconds: 300 } as const;
const previewMemoryStore = new MemoryRateLimitStore();

/**
 * Real-time coupon preview for the checkout step-4 input.
 *
 * Cosmetic only — the authoritative apply happens in the
 * `redeem_coupon` Postgres RPC at submit time. This action exists so
 * the customer sees instant feedback ("WELCOME10 saves $25" vs.
 * "WELCOME10 doesn't beat your current Stack & Save discount") rather
 * than typing a code, submitting, and finding out silently.
 *
 * Calls do NOT redeem — they're stateless lookups + math against the
 * pure best-of helper. The cap-reached states are best-effort: we
 * count past redemptions but don't lock anything, so the actual apply
 * can still come up short if a concurrent order beat them to it.
 */

const PreviewSchema = z.object({
  code: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Coupon code is required.")
    .max(64),
  subtotal_cents: z.number().int().min(0).max(100_000_000),
  other_discount_cents: z.number().int().min(0).max(100_000_000),
  email: z.string().trim().email().max(200).optional().nullable(),
  // Total peptide-vial units in the cart (excludes BAC water,
  // syringes, and other supplies). Required for FOUNDER's 3-vial
  // gate — the preview rejects the code with a friendly message if
  // the gate fails, which keeps the customer from submitting and
  // discovering the rule too late.
  vial_quantity: z.number().int().min(0).max(500).optional().default(0),
});

export type CouponPreviewStatus =
  | "applied"
  | "bestof_loses"
  | "not_found"
  | "expired"
  | "not_yet_active"
  | "min_subtotal_not_met"
  | "global_cap_reached"
  | "per_email_cap_reached"
  | "auth_required"
  | "invalid_input";

export interface CouponPreviewResult {
  status: CouponPreviewStatus;
  /** Cents the customer would save IF the coupon wins best-of. */
  coupon_discount_cents: number;
  /** Cents the existing stack saves (Stack & Save + same-SKU + affiliate + referral). */
  other_discount_cents: number;
  /** Cents actually applied at submit time (the larger of the two). */
  applied_discount_cents: number;
  /** Order total after `applied_discount_cents` is taken off. */
  next_total_cents: number;
  /** Human-friendly message for inline UI. */
  message: string;
}

function genericUnavailable(
  subtotal_cents: number,
  other_discount_cents: number,
): CouponPreviewResult {
  return {
    status: "not_found",
    coupon_discount_cents: 0,
    other_discount_cents,
    applied_discount_cents: other_discount_cents,
    next_total_cents: Math.max(0, subtotal_cents - other_discount_cents),
    message: "Coupon could not be applied.",
  };
}

export async function previewCouponForCheckout(
  raw: unknown,
): Promise<CouponPreviewResult> {
  // Rate-limit before any DB lookup. Failure messages from this
  // action used to differentiate "not_found" vs "expired" vs
  // "global_cap_reached" — that's a leak vector for an attacker
  // probing the coupon table. After the limit kicks in we collapse
  // to a generic message.
  try {
    const headerBag = await headers();
    const ipRes = resolveClientIp(headerBag, {
      isProduction: process.env.NODE_ENV === "production",
    });
    const ip = ipRes.ok ? ipRes.ip : "unknown";
    const supaForLimit = getSupabaseServer();
    const store = supaForLimit
      ? new SupabaseRateLimitStore(supaForLimit)
      : previewMemoryStore;
    const rl = await checkAndIncrement({
      bucket: `coupon-preview:${ip}`,
      limit: PREVIEW_RATE_LIMIT.limit,
      windowSeconds: PREVIEW_RATE_LIMIT.windowSeconds,
      store,
    });
    if (!rl.allowed) {
      const subtotal_cents =
        typeof (raw as { subtotal_cents?: unknown }).subtotal_cents === "number"
          ? ((raw as { subtotal_cents: number }).subtotal_cents)
          : 0;
      const other_discount_cents =
        typeof (raw as { other_discount_cents?: unknown }).other_discount_cents ===
        "number"
          ? ((raw as { other_discount_cents: number }).other_discount_cents)
          : 0;
      return genericUnavailable(subtotal_cents, other_discount_cents);
    }
  } catch {
    // Rate-limit infra error → fall through and try the lookup
    // anyway. Better to over-serve than to break the check entirely.
  }

  const parsed = PreviewSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      status: "invalid_input",
      coupon_discount_cents: 0,
      other_discount_cents: 0,
      applied_discount_cents: 0,
      next_total_cents: 0,
      message: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }
  const { code, subtotal_cents, other_discount_cents, email } = parsed.data;
  const supa = getSupabaseServer();
  // No DB → behave as if the coupon doesn't exist; the customer can
  // still submit and the server will reach the same conclusion.
  if (!supa) {
    return {
      status: "not_found",
      coupon_discount_cents: 0,
      other_discount_cents,
      applied_discount_cents: other_discount_cents,
      next_total_cents: Math.max(0, subtotal_cents - other_discount_cents),
      message: "Coupon service unavailable.",
    };
  }

  // FIRST250 cohort gate: only authenticated researchers can claim
  // (founder spec — "make sure all the members who want the discount
  // create an account"). Surface the requirement BEFORE the coupon
  // table lookup so the customer gets a clear actionable message
  // instead of a generic "doesn't apply" rejection.
  if (code === "first250") {
    try {
      const cookieClient = await createServerSupabase();
      const {
        data: { user },
      } = await cookieClient.auth.getUser();
      if (!user) {
        return {
          status: "auth_required",
          coupon_discount_cents: 0,
          other_discount_cents,
          applied_discount_cents: other_discount_cents,
          next_total_cents: Math.max(0, subtotal_cents - other_discount_cents),
          message:
            "FIRST250 is for the launch cohort — create a free Bench Grade Peptides account to claim it. We'll save your cart and bring you right back here.",
        };
      }
    } catch (err) {
      console.error("[previewCoupon] auth check failed:", err);
      // Fail open on infra error — better to let them proceed and
      // have submitOrder reject than to block on a transient hiccup.
    }
  }

  const { data: rec, error } = await supa
    .from("coupons")
    .select(
      "code, percent_off, flat_off_cents, min_subtotal_cents, valid_from, valid_until, max_redemptions, max_per_email",
    )
    .eq("code", code)
    .maybeSingle();
  if (error || !rec) {
    return {
      status: "not_found",
      coupon_discount_cents: 0,
      other_discount_cents,
      applied_discount_cents: other_discount_cents,
      next_total_cents: Math.max(0, subtotal_cents - other_discount_cents),
      message: `Coupon "${code.toUpperCase()}" not found.`,
    };
  }

  const coupon = rec as CouponRecord;
  const syncFail = validateCouponSync(coupon, subtotal_cents);
  if (syncFail) return failureResult(syncFail, subtotal_cents, other_discount_cents);

  // Soft cap check — count redemptions; we don't lock anything since
  // this is a preview. The atomic apply at submit time will lock the
  // coupon row FOR UPDATE.
  if (coupon.max_redemptions !== null) {
    const { count } = await supa
      .from("coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_code", code);
    if ((count ?? 0) >= coupon.max_redemptions) {
      // Special case: FIRST250 is publicly advertised as a 250-order
      // launch cohort. When it exhausts we surface the marketed
      // narrative ("250 orders already placed") and steer the
      // researcher to the FOUNDER fallback. Disclosure is fine here
      // because FIRST250 itself is widely promoted — we're not
      // leaking the existence of an internal coupon.
      if (code === "first250") {
        return {
          status: "global_cap_reached",
          coupon_discount_cents: 0,
          other_discount_cents,
          applied_discount_cents: other_discount_cents,
          next_total_cents: Math.max(
            0,
            subtotal_cents - other_discount_cents,
          ),
          message:
            "Sorry — all 250 launch-cohort orders have been placed. As a thank-you from the founder, use code FOUNDER for 25% off when you stack 3+ vials. Spend $500 → free vial; spend $1,000 → 2 free vials.",
        };
      }
      return failureResult("global_cap_reached", subtotal_cents, other_discount_cents);
    }
  }

  if (email) {
    const { count } = await supa
      .from("coupon_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("coupon_code", code)
      .eq("customer_email_lower", email.trim().toLowerCase());
    if ((count ?? 0) >= coupon.max_per_email) {
      return failureResult(
        "per_email_cap_reached",
        subtotal_cents,
        other_discount_cents,
      );
    }
  }

  // FOUNDER application-layer gate: 3+ peptide vials required. The
  // schema can't express this (coupons table only has min_subtotal_cents),
  // so the preview surfaces it as a friendly rejection so the
  // customer doesn't submit + only then learn the rule.
  if (code === "founder" && parsed.data.vial_quantity < 3) {
    return {
      status: "min_subtotal_not_met",
      coupon_discount_cents: 0,
      other_discount_cents,
      applied_discount_cents: other_discount_cents,
      next_total_cents: Math.max(0, subtotal_cents - other_discount_cents),
      message:
        "FOUNDER applies when you stack 3 or more vials. Add a few more to your cart and try again.",
    };
  }

  const r = applyCoupon({
    subtotal_cents,
    other_discount_cents,
    coupon,
  });

  if (!r.coupon_won) {
    return {
      status: "bestof_loses",
      coupon_discount_cents: r.coupon_discount_cents,
      other_discount_cents,
      applied_discount_cents: r.applied_discount_cents,
      next_total_cents: r.next_total_cents,
      message: `Your current discount (${formatDollars(other_discount_cents)}) already beats ${code.toUpperCase()} (${formatDollars(r.coupon_discount_cents)}). We'll keep the larger one.`,
    };
  }

  const savedExtra = r.coupon_discount_cents - other_discount_cents;
  return {
    status: "applied",
    coupon_discount_cents: r.coupon_discount_cents,
    other_discount_cents,
    applied_discount_cents: r.applied_discount_cents,
    next_total_cents: r.next_total_cents,
    message: `${code.toUpperCase()} applied — saves ${formatDollars(r.coupon_discount_cents)}${other_discount_cents > 0 ? ` (${formatDollars(savedExtra)} more than your current discount)` : ""}.`,
  };
}

function failureResult(
  failure: CouponValidationFailure,
  subtotal_cents: number,
  other_discount_cents: number,
): CouponPreviewResult {
  const messages: Record<CouponValidationFailure, string> = {
    not_found: "Coupon not found.",
    expired: "This coupon has expired.",
    not_yet_active: "This coupon isn't active yet.",
    min_subtotal_not_met: "Order subtotal doesn't meet this coupon's minimum.",
    global_cap_reached: "This coupon has hit its redemption cap.",
    per_email_cap_reached: "You've already used this coupon the maximum number of times.",
    would_not_save_money: "This coupon doesn't beat your current discount.",
  };
  return {
    status: failure as CouponPreviewStatus,
    coupon_discount_cents: 0,
    other_discount_cents,
    applied_discount_cents: other_discount_cents,
    next_total_cents: Math.max(0, subtotal_cents - other_discount_cents),
    message: messages[failure],
  };
}

function formatDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
