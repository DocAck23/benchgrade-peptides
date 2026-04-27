"use server";

import crypto from "node:crypto";
import { headers, cookies } from "next/headers";
import { z } from "zod";
import { RUO_STATEMENTS } from "@/lib/compliance";
import { PRODUCTS, getSupplyVariantBySku } from "@/lib/catalogue/data";
import type { CatalogProduct } from "@/lib/catalogue/data";
import type { CartItem } from "@/lib/cart/types";
import { computeCartTotals } from "@/lib/cart/discounts";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getResend, EMAIL_FROM, ADMIN_NOTIFICATION_EMAIL } from "@/lib/email/client";
import {
  orderConfirmationEmail,
  adminOrderNotification,
  accountClaimEmail,
} from "@/lib/email/templates";
import { SITE_URL } from "@/lib/site";
import { SupabaseRateLimitStore } from "@/lib/ratelimit/supabase-store";
import { MemoryRateLimitStore } from "@/lib/ratelimit/memory-store";
import { enforceOrderRateLimit } from "@/lib/ratelimit/enforce";
import { resolveClientIp } from "@/lib/ratelimit/ip";
import {
  PAYMENT_METHODS,
  enabledPaymentMethods,
  type PaymentMethod,
} from "@/lib/payments/methods";
import {
  subscriptionDiscountPercent,
  computeSubscriptionTotals,
} from "@/lib/subscriptions/discounts";
import { createSubscription } from "@/app/actions/subscriptions";
import { parseReferralCookie } from "@/lib/referrals/cookie";
import { composeReferralDiscount } from "@/lib/referrals/discount";
import { makeSuccessToken } from "@/lib/orders/success-token";
import { US_STATES_AND_TERRITORIES } from "@/lib/geography/us-states";
import { upsertMarketingSubscriber } from "@/lib/marketing/subscribers";
// Coupon math runs server-side in the `redeem_coupon` Postgres RPC
// (one atomic transaction). The pure helper at @/lib/coupons/apply is
// kept for future cart-preview UI use.
import { createNowpaymentsInvoice } from "@/lib/payments/nowpayments/invoice";
import { sendCryptoPaymentLink } from "@/lib/email/notifications/send-order-emails";
import type { OrderRow } from "@/lib/supabase/types";
import { claimReferralOnOrder } from "@/app/actions/referrals";
import { createServerSupabase } from "@/lib/supabase/client";
import { escapeLikePattern } from "@/lib/text/like-escape";
import {
  personalVialDiscount,
  type AffiliateTier,
} from "@/lib/affiliate/tiers";

// Dev-only fallback store — in prod we require Supabase-backed counting.
const devMemoryStore = new MemoryRateLimitStore();

const CERTIFICATION_VERSION = "2026-04-22";

// Whitelist of valid US state + territory + military-mail 2-letter codes.
// US state/territory/military codes live in @/lib/geography/us-states
// (imported at the top of this file).

export interface CustomerInfo {
  name: string;
  email: string;
  institution: string;
  phone: string;
  ship_address_1: string;
  ship_address_2?: string;
  ship_city: string;
  ship_state: string;
  ship_zip: string;
  notes?: string;
}

/**
 * What the client sends. Crucially we only trust SKU + quantity; every
 * price, name, and image is re-resolved from the server-side catalog.
 * Client-supplied cart metadata is ignored.
 */
export interface ClientCartLine {
  sku: string;
  quantity: number;
}

export interface ClientAcknowledgment {
  is_adult: boolean;
  is_researcher: boolean;
  accepts_ruo: boolean;
}

/**
 * Optional subscription selection. When set, the customer toggled the
 * subscribe-and-save card at checkout; submitOrder will create a
 * subscription row linked to this order via createSubscription. Validity
 * of the (duration × payment × ship) combo is checked server-side via
 * subscriptionDiscountPercent — invalid combos fall through to one-shot.
 */
export interface SubmitOrderSubscriptionMode {
  duration_months: 1 | 3 | 6 | 9 | 12;
  payment_cadence: "prepay" | "bill_pay";
  ship_cadence: "monthly" | "quarterly" | "once";
}

export interface SubmitOrderInput {
  customer: CustomerInfo;
  items: ClientCartLine[];
  acknowledgment: ClientAcknowledgment;
  payment_method: PaymentMethod;
  subscription_mode?: SubmitOrderSubscriptionMode | null;
  /** Defaults to true at the schema layer if omitted. */
  marketing_opt_in?: boolean;
  /** Optional coupon code from the cart. Best-of vs Stack & Save / referral. */
  coupon_code?: string | null;
  /**
   * Sprint 5 — first-time-buyer vial discount. If the customer is a
   * first-time buyer (no prior orders for this email) AND the SKU is
   * a real peptide vial in their cart, the server applies 50% off one
   * unit of that line. Spoofable by the client → re-validated server-
   * side via a count of prior orders for `lower(customer.email)`.
   */
  first_time_vial_sku?: string | null;
}

export interface SubmitOrderResult {
  ok: boolean;
  order_id?: string;
  /**
   * Short-lived HMAC token for /checkout/success?id=<order_id>&t=<token>.
   * Without it the success page would expose order details to anyone
   * who knew the order UUID. 1-hour lifetime; rotated each submit.
   */
  success_token?: string;
  error?: string;
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

/**
 * Whole-input runtime validation. This is the authoritative boundary —
 * TS types don't narrow across the server action RPC, so a hostile client
 * can send anything. Zod bounds every field and caps collection sizes so
 * the action can't be weaponized as a DoS on PRODUCTS.find() / PG insert.
 */
const CustomerSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.string().trim().email("Valid email is required.").max(200),
  institution: z.string().trim().max(200).default(""),
  phone: z.string().trim().max(40).default(""),
  ship_address_1: z.string().trim().min(1, "Shipping address is required.").max(200),
  ship_address_2: z.string().trim().max(200).optional(),
  ship_city: z.string().trim().min(1, "City is required.").max(100),
  ship_state: z
    .string()
    .trim()
    .transform((s) => s.toUpperCase())
    .refine((s) => US_STATES_AND_TERRITORIES.has(s), {
      message: "Valid US state, territory, or APO code is required.",
    }),
  ship_zip: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/u, "ZIP code is invalid."),
  notes: z.string().trim().max(1000).optional(),
});

const CartLineSchema = z.object({
  sku: z
    .string()
    .trim()
    .regex(/^[A-Z0-9-]{3,40}$/u, "Invalid SKU format."),
  quantity: z.number().int().positive().max(500),
});

const AcknowledgmentSchema = z.object({
  is_adult: z.literal(true, { message: "Age certification is required." }),
  is_researcher: z.literal(true, { message: "Researcher certification is required." }),
  accepts_ruo: z.literal(true, { message: "RUO certification is required." }),
});

const PaymentMethodSchema = z.enum(PAYMENT_METHODS);

// Plan-shape validation only. Cross-field validity (e.g. bill_pay+1mo) is
// recomputed server-side via subscriptionDiscountPercent below; an
// invalid combo there logs and falls through to a one-shot order rather
// than rejecting the entire checkout.
const SubscriptionModeSchema = z
  .object({
    duration_months: z.union([
      z.literal(1),
      z.literal(3),
      z.literal(6),
      z.literal(9),
      z.literal(12),
    ]),
    payment_cadence: z.enum(["prepay", "bill_pay"]),
    ship_cadence: z.enum(["monthly", "quarterly", "once"]),
  })
  .optional()
  .nullable();

const SubmitOrderSchema = z.object({
  customer: CustomerSchema,
  items: z.array(CartLineSchema).min(1, "Cart is empty.").max(20, "Cart too large."),
  acknowledgment: AcknowledgmentSchema,
  payment_method: PaymentMethodSchema,
  subscription_mode: SubscriptionModeSchema,
  // Marketing-email opt-in checkbox state from checkout. Defaults to
  // true (the checkbox is pre-checked); customer can untick at submit
  // time. Persisted on the order row + mirrored to marketing_subscribers.
  marketing_opt_in: z.boolean().default(true),
  // Optional coupon code typed in at checkout. Normalized to lowercase
  // server-side; non-existent / expired / capped codes return a clean
  // error path (the order still submits, but no discount is applied).
  coupon_code: z.string().trim().toLowerCase().min(1).max(64).optional().nullable(),
  // Sprint 5 — first-time vial pick. Re-validated server-side: must
  // belong to a peptide product in cart; email must have no prior
  // orders. If anything fails, no discount, order proceeds normally.
  first_time_vial_sku: z
    .string()
    .trim()
    .regex(/^[A-Z0-9-]{3,40}$/u, "Invalid SKU format.")
    .optional()
    .nullable(),
});

function resolveCartOnServer(
  lines: ClientCartLine[]
): { items: CartItem[]; subtotal_cents: number } | { error: string } {
  if (!Array.isArray(lines) || lines.length === 0) return { error: "Cart is empty." };
  const items: CartItem[] = [];
  let subtotal_cents = 0;
  for (const line of lines) {
    const qty = Math.floor(Number(line.quantity));
    if (!Number.isFinite(qty) || qty <= 0 || qty > 500) {
      return { error: `Invalid quantity for ${line.sku}.` };
    }
    // Resolve from PRODUCTS first; fall back to SUPPLIES (BAC water,
    // syringes, draw needles) which are auto-added but never appear in
    // the public catalogue.
    let match: CatalogProduct | undefined = PRODUCTS.find((p) =>
      p.variants.some((v) => v.sku === line.sku),
    );
    let variant = match?.variants.find((v) => v.sku === line.sku);
    let isSupply = false;
    if (!match || !variant) {
      const supply = getSupplyVariantBySku(line.sku);
      if (supply) {
        match = supply.product;
        variant = supply.variant;
        isSupply = true;
      }
    }
    if (!match || !variant) return { error: `Unknown SKU: ${line.sku}` };
    items.push({
      sku: variant.sku,
      product_slug: match.slug,
      category_slug: match.category_slug,
      name: match.name,
      size_mg: variant.size_mg,
      pack_size: variant.pack_size,
      unit_price: variant.retail_price,
      quantity: qty,
      vial_image: match.vial_image,
      ...(isSupply ? { is_supply: true as const } : {}),
    });
    // First-unit-free pricing on bundle supplies — mirrors the cart's
    // `lineSubtotalCents` so server-computed total matches what the
    // user saw in the drawer.
    const billable = isSupply ? Math.max(0, qty - 1) : qty;
    subtotal_cents += Math.round(variant.retail_price * 100) * billable;
  }
  return { items, subtotal_cents };
}

/**
 * Sprint 5 — pre-submit lookup used by the multi-step checkout to
 * decide whether to surface the 50%-off-any-vial first-time addon.
 * Cosmetic only — `submitOrder` re-validates server-side before
 * applying the discount, so spoofing this just gets you a denied
 * discount.
 *
 * "First-time" = zero non-cancelled orders matching the lower-cased
 * email. Errors fail closed (returns false) so the addon stays hidden
 * if we can't confirm.
 */
export async function checkIsFirstTimeBuyer(
  email: string,
): Promise<{ first_time: boolean }> {
  try {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^\S+@\S+\.\S+$/u.test(trimmed)) {
      return { first_time: false };
    }
    const supa = getSupabaseServer();
    if (!supa) return { first_time: false };
    // Escape ILIKE metacharacters (`_`, `%`, `\`) so a legal email
    // like `a_b@example.com` doesn't act as a wildcard and match
    // unrelated customers — codex review #1.
    const { count, error } = await supa
      .from("orders")
      .select("order_id", { count: "exact", head: true })
      .ilike("customer->>email", escapeLikePattern(trimmed))
      .neq("status", "cancelled");
    if (error) {
      console.error("[checkIsFirstTimeBuyer] failed:", error);
      return { first_time: false };
    }
    return { first_time: (count ?? 0) === 0 };
  } catch (err) {
    console.error("[checkIsFirstTimeBuyer] threw:", err);
    return { first_time: false };
  }
}

export async function submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
  // IP + UA resolution + rate-limit check come FIRST — before any semantic
  // validation — so a client hammering the action with malformed payloads
  // can't probe the system without consuming their quota.
  const headerBag = await headers();
  const ipResult = resolveClientIp(headerBag, {
    isProduction: process.env.NODE_ENV === "production",
  });
  if (!ipResult.ok) return { ok: false, error: ipResult.reason };
  const ip = ipResult.ip;
  const userAgent = headerBag.get("user-agent") ?? "unknown";

  // Capture the analytics session_id from the cookie so we can attribute
  // this order to a single utm/referrer source. We don't fail closed
  // here — orders without a session id (cookies disabled, server-side
  // submission, etc.) still go through; they just land as `null` for
  // attribution purposes.
  const cookieJar = await cookies();
  const sessionCookie = cookieJar.get("bgp_sess")?.value ?? null;
  const sessionId =
    sessionCookie && /^[0-9a-f-]{36}$/i.test(sessionCookie)
      ? sessionCookie
      : null;

  // Rate-limit before we touch the DB. Supabase-backed in prod; dev falls
  // back to in-memory so `npm run dev` works without a live DB.
  const supaForLimiter = getSupabaseServer();
  const limitStore = supaForLimiter
    ? new SupabaseRateLimitStore(supaForLimiter)
    : devMemoryStore;
  const limitCheck = await enforceOrderRateLimit(limitStore, ip);
  if (!limitCheck.allowed) {
    return { ok: false, error: limitCheck.error };
  }

  // Whole-input validation. Client-side form checks are UX sugar; this
  // is the authoritative gate.
  const parsed = SubmitOrderSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid order submission.";
    return { ok: false, error: first };
  }
  const validInput = parsed.data;
  const { acknowledgment, payment_method } = validInput;

  // Second gate: even if the client sent a valid enum value, the method
  // must be ENABLED in the current env. Stops an old form or bad actor
  // from submitting "crypto" before NOWPAYMENTS_API_KEY lands.
  if (!enabledPaymentMethods().includes(payment_method)) {
    return {
      ok: false,
      error: `Payment method "${payment_method}" is not currently available. Please choose another.`,
    };
  }

  const resolved = resolveCartOnServer(validInput.items);
  if ("error" in resolved) return { ok: false, error: resolved.error };

  // Authoritative discount math — server-side only. Anything the client
  // sent in `discount_cents` / `total_cents` was schema-stripped by Zod
  // upstream; even if they slipped through, we ignore them here. The
  // engine is the single source of truth so a hostile client can't
  // forge a $0 total.
  const oneShotTotals = computeCartTotals(resolved.items);

  // Codex review #3 H1: when the customer toggled subscription mode at
  // checkout, the order itself must reflect subscription pricing — not
  // the one-shot Stack&Save engine. Prepay charges plan_total upfront
  // (cycle_total × duration); bill-pay charges only cycle 1.
  // Non-subscription orders keep the one-shot path (Stack&Save +
  // free-vial entitlement).
  let basePricing: {
    subtotal_cents: number;
    total_cents: number;
    free_vial_entitlement: typeof oneShotTotals.free_vial_entitlement;
  };
  let subscriptionPlanValid = false;
  if (validInput.subscription_mode) {
    const pct = subscriptionDiscountPercent({
      duration_months: validInput.subscription_mode.duration_months,
      payment_cadence: validInput.subscription_mode.payment_cadence,
      ship_cadence: validInput.subscription_mode.ship_cadence,
    });
    if (pct > 0) {
      subscriptionPlanValid = true;
      const subTotals = computeSubscriptionTotals(
        oneShotTotals.subtotal_cents,
        {
          duration_months: validInput.subscription_mode.duration_months,
          payment_cadence: validInput.subscription_mode.payment_cadence,
          ship_cadence: validInput.subscription_mode.ship_cadence,
        }
      );
      const duration = validInput.subscription_mode.duration_months;
      if (validInput.subscription_mode.payment_cadence === "prepay") {
        // Prepay: charge full plan upfront (post-discount × N).
        basePricing = {
          subtotal_cents: subTotals.cycle_subtotal_cents * duration,
          total_cents: subTotals.plan_total_cents,
          free_vial_entitlement: null,
        };
      } else {
        // Bill-pay: charge cycle 1 only; cycles 2+ via customer's bank
        // bill-pay (created in createSubscription with next_charge_date).
        basePricing = {
          subtotal_cents: subTotals.cycle_subtotal_cents,
          total_cents: subTotals.cycle_total_cents,
          free_vial_entitlement: null,
        };
      }
    } else {
      // Invalid subscription combo (e.g. bill_pay+1mo). Fall through to
      // one-shot pricing; the warning + skip happens in the
      // createSubscription branch below.
      basePricing = {
        subtotal_cents: oneShotTotals.subtotal_cents,
        total_cents: oneShotTotals.total_cents,
        free_vial_entitlement: oneShotTotals.free_vial_entitlement,
      };
    }
  } else {
    basePricing = {
      subtotal_cents: oneShotTotals.subtotal_cents,
      total_cents: oneShotTotals.total_cents,
      free_vial_entitlement: oneShotTotals.free_vial_entitlement,
    };
  }
  // Reference for backward compat with downstream code that previously
  // read `totals.subtotal_cents` / `totals.total_cents`.
  const totals = {
    subtotal_cents: basePricing.subtotal_cents,
    total_cents: basePricing.total_cents,
    free_vial_entitlement: basePricing.free_vial_entitlement,
  };
  // Mark used so the linter doesn't flag plan-validity bookkeeping that
  // is consumed in the createSubscription branch below.
  void subscriptionPlanValid;

  // Sprint 4 Wave C — affiliate personal-discount hook. If the buyer is
  // authenticated AND has an `affiliates` row, apply their tier's personal
  // vial discount to the post-Stack-&-Save total. Affiliate discount STACKS
  // with Stack & Save — they're rewards from different programs (loyalty
  // bulk vs. partner perk).
  //
  // Caveat: customer_user_id is captured asynchronously (claim-on-first-
  // order via the magic-link email). For a v1 first-order checkout, the
  // customer is NOT yet an affiliate (they have no auth.uid bound to their
  // email yet). This hook only fires for repeat customers who have signed
  // in to their account, hit checkout, and whose user.id resolves to an
  // affiliates row. Best-effort: any error here → no affiliate discount,
  // order proceeds normally.
  let affiliateDiscountPct = 0;
  let affiliateDiscountCents = 0;
  try {
    const cookieClient = await createServerSupabase();
    const {
      data: { user: authedUser },
    } = await cookieClient.auth.getUser();
    if (authedUser) {
      const { data: aff } = await cookieClient
        .from("affiliates")
        .select("tier")
        .eq("user_id", authedUser.id)
        .maybeSingle();
      if (aff && typeof (aff as { tier?: string }).tier === "string") {
        const tier = (aff as { tier: AffiliateTier }).tier;
        affiliateDiscountPct = personalVialDiscount(tier);
        affiliateDiscountCents = Math.round(
          totals.total_cents * (affiliateDiscountPct / 100)
        );
      }
    }
  } catch (err) {
    console.error("[submitOrder] affiliate discount lookup failed:", err);
    affiliateDiscountPct = 0;
    affiliateDiscountCents = 0;
  }

  // Sprint 5 — first-time-buyer 50%-off-any-vial addon. Server-validated:
  //   • the SKU must be present in the resolved cart and not a supply line
  //   • the buyer's email must have zero prior orders
  // Discount = 50% of one unit's retail price for that SKU. Stacks with
  // every other discount (it's a one-time acquisition incentive).
  let firstTimeVialDiscountCents = 0;
  let firstTimeVialSkuApplied: string | null = null;
  if (validInput.first_time_vial_sku) {
    try {
      const targetSku = validInput.first_time_vial_sku;
      const targetLine = resolved.items.find(
        (i) => i.sku === targetSku && !("is_supply" in i && i.is_supply),
      );
      if (targetLine) {
        const supa2 = getSupabaseServer();
        let isFirstTime = true;
        if (supa2) {
          const emailLower = validInput.customer.email.trim().toLowerCase();
          // Escape ILIKE metacharacters — codex review #1.
          const { count, error: cntErr } = await supa2
            .from("orders")
            .select("order_id", { count: "exact", head: true })
            .ilike("customer->>email", escapeLikePattern(emailLower))
            .neq("status", "cancelled");
          if (cntErr) {
            console.error(
              "[submitOrder] first-time vial discount lookup failed:",
              cntErr,
            );
            isFirstTime = false;
          } else {
            isFirstTime = (count ?? 0) === 0;
          }
        }
        if (isFirstTime) {
          firstTimeVialDiscountCents = Math.round(
            targetLine.unit_price * 100 * 0.5,
          );
          firstTimeVialSkuApplied = targetSku;
        }
      }
    } catch (err) {
      console.error("[submitOrder] first-time vial discount threw:", err);
      firstTimeVialDiscountCents = 0;
    }
  }

  const finalTotalCents =
    totals.total_cents - affiliateDiscountCents - firstTimeVialDiscountCents;
  const discount_cents =
    totals.subtotal_cents -
    totals.total_cents +
    affiliateDiscountCents +
    firstTimeVialDiscountCents;
  void firstTimeVialSkuApplied;

  // Certification text + timestamp are stamped from server-side constants,
  // not from the client. The hash binds compound inputs that make the ack
  // evidence-unique per order (HIGH H6 codex fix).
  const certification_text = RUO_STATEMENTS.certification;
  const acknowledged_at = new Date().toISOString();
  const order_id = crypto.randomUUID();
  // Hash a stable JSON object (sorted keys) rather than a pipe-joined
  // string so the hash doesn't silently collide if any field ever contains
  // a "|" character in the future.
  const certification_hash = sha256Hex(
    JSON.stringify({
      acknowledged_at,
      certification_text,
      certification_version: CERTIFICATION_VERSION,
      ip,
      order_id,
    })
  );

  const row = {
    order_id,
    customer: validInput.customer,
    items: resolved.items,
    // Codex review #3 H1: in subscription mode `totals.subtotal_cents`
    // already reflects plan vs cycle math (prepay → cycle_subtotal × N;
    // bill_pay → cycle_subtotal). Non-subscription orders preserve the
    // one-shot subtotal exactly (= resolved.subtotal_cents).
    subtotal_cents: totals.subtotal_cents,
    discount_cents,
    total_cents: finalTotalCents,
    free_vial_entitlement: totals.free_vial_entitlement,
    payment_method,
    acknowledgment: {
      certification_text,
      certification_version: CERTIFICATION_VERSION,
      certification_hash,
      is_adult: acknowledgment.is_adult,
      is_researcher: acknowledgment.is_researcher,
      accepts_ruo: acknowledgment.accepts_ruo,
      acknowledged_at,
      ip,
      user_agent: userAgent,
    },
    status: "awaiting_payment" as const,
    marketing_opt_in: validInput.marketing_opt_in,
    session_id: sessionId,
    created_at: acknowledged_at,
  };

  const supa = getSupabaseServer();
  if (!supa) {
    // Fail closed in production: no persistence = no order. Evidence of
    // RUO consent must be durable or we can't legally ship.
    if (process.env.NODE_ENV === "production") {
      return {
        ok: false,
        error: "Order service unavailable. Please try again in a few minutes.",
      };
    }
    console.info(
      "[submitOrder] Supabase not configured; dev-mode logging only:\n",
      JSON.stringify(row, null, 2)
    );
    return { ok: true, order_id, success_token: makeSuccessToken(order_id) };
  }

  const { error: orderError } = await supa.from("orders").insert(row);
  if (orderError) return { ok: false, error: `Order persistence failed: ${orderError.message}` };

  const { error: ackError } = await supa.from("ruo_acknowledgments").insert({
    order_id,
    certification_text,
    certification_hash,
    is_adult: acknowledgment.is_adult,
    is_researcher: acknowledgment.is_researcher,
    accepts_ruo: acknowledgment.accepts_ruo,
    ip,
    user_agent: userAgent,
    acknowledged_at,
  });
  if (ackError) {
    // Two-phase write compensation: the order row already landed but
    // the compliance-evidence mirror didn't. We can't ship without
    // that row, and if we leave the order behind the customer will
    // retry and we'll end up with duplicates. Best-effort delete the
    // order before returning.
    //
    // NOT a real transaction — Supabase-js can't open one — but close
    // enough pre-launch. Long-term fix: move both writes into a single
    // Postgres RPC `submit_order()` wrapped in BEGIN/COMMIT.
    const { error: compensationError } = await supa
      .from("orders")
      .delete()
      .eq("order_id", order_id);
    if (compensationError) {
      console.error(
        "[submitOrder] CRITICAL: ack mirror failed AND order rollback failed",
        { order_id, ackError: ackError.message, compensationError: compensationError.message }
      );
    }
    return {
      ok: false,
      error: `Order submission failed at compliance step. Please retry in a minute; if it persists, email admin@benchgradepeptides.com with any reference you have.`,
    };
  }

  // Marketing-list housekeeping — opt-in or revive subscription
  // based on the checkout checkbox. Best-effort: a failure here MUST
  // NOT roll back an order that already landed.
  if (validInput.marketing_opt_in) {
    try {
      await upsertMarketingSubscriber(validInput.customer.email, order_id);
    } catch (err) {
      console.error("[submitOrder] upsertMarketingSubscriber failed:", err);
    }
  }

  // Subscription branch — Wave C1. If the customer toggled the
  // subscribe-and-save upsell, persist a subscription row linked to this
  // order. Best-effort: if createSubscription or the back-link UPDATE
  // fails, the order still succeeds (the customer paid for cycle 1 and
  // admin can manually create the subscription later). We also recompute
  // plan validity server-side via subscriptionDiscountPercent — never
  // trust the client.
  if (validInput.subscription_mode) {
    const pct = subscriptionDiscountPercent({
      duration_months: validInput.subscription_mode.duration_months,
      payment_cadence: validInput.subscription_mode.payment_cadence,
      ship_cadence: validInput.subscription_mode.ship_cadence,
    });
    if (pct === 0) {
      console.warn(
        "[submitOrder] invalid subscription plan combo, falling through to one-shot",
        validInput.subscription_mode
      );
    } else {
      try {
        const subResult = await createSubscription({
          customer_user_id: null, // null until magic-link claim binds it
          customer_email: validInput.customer.email,
          items: resolved.items,
          plan: {
            duration_months: validInput.subscription_mode.duration_months,
            payment_cadence: validInput.subscription_mode.payment_cadence,
            ship_cadence: validInput.subscription_mode.ship_cadence,
          },
          first_order_id: order_id,
        });
        if (!subResult.ok) {
          console.error(
            "[submitOrder] createSubscription failed:",
            subResult.error
          );
        } else if (subResult.subscription_id) {
          // Compensating back-link — the order was inserted before we
          // knew the subscription id. Best-effort: if this fails, the
          // order is just unlinked but otherwise normal.
          const { error: linkErr } = await supa
            .from("orders")
            .update({ subscription_id: subResult.subscription_id })
            .eq("order_id", order_id);
          if (linkErr) {
            console.error(
              "[submitOrder] subscription_id link failed:",
              linkErr
            );
          }
        }
      } catch (err) {
        console.error("[submitOrder] subscription creation threw:", err);
      }
    }
  }

  // Emails are best-effort — the order is already durable in Supabase,
  // so a transient Resend failure shouldn't flip the response to an
  // error the customer sees. We log and move on; ops can resend from
  // the admin dashboard if needed.
  const resend = getResend();
  const emailCtx = {
    order_id,
    customer: validInput.customer,
    items: resolved.items,
    subtotal_cents: resolved.subtotal_cents,
    total_cents: finalTotalCents,
    payment_method,
  };

  if (resend) {
    const customerEmail = orderConfirmationEmail(emailCtx);
    const adminEmail = adminOrderNotification(emailCtx);
    try {
      await Promise.all([
        resend.emails.send({
          from: EMAIL_FROM,
          to: validInput.customer.email,
          subject: customerEmail.subject,
          text: customerEmail.text,
          html: customerEmail.html,
        }),
        resend.emails.send({
          from: EMAIL_FROM,
          to: ADMIN_NOTIFICATION_EMAIL,
          subject: adminEmail.subject,
          text: adminEmail.text,
          html: adminEmail.html,
        }),
      ]);
    } catch (err) {
      console.error("[submitOrder] email dispatch failed:", err);
    }
  }

  // Account-claim magic link — generated UNCONDITIONALLY, even when
  // Resend isn't configured. Supabase admin.generateLink returns a
  // single-use sign-in URL whether or not we have an emailer; if Resend
  // is up we email it, if not we log it so an admin can recover the
  // claim flow manually. Customer can also always request a fresh
  // link from /login on their own.
  try {
    const { data: linkData } = await supa.auth.admin.generateLink({
      type: "magiclink",
      email: validInput.customer.email,
      options: { redirectTo: `${SITE_URL}/auth/callback?next=/account` },
    });
    const actionLink = linkData?.properties?.action_link;
    // Defense-in-depth: explicitly assert https scheme before passing
    // the URL into an email template. escapeHtml() handles attribute
    // escaping, but a non-https value (javascript:, data:, http:) would
    // survive escaping and remain clickable.
    if (actionLink && actionLink.startsWith("https://")) {
      if (resend) {
        const claim = accountClaimEmail({
          ...emailCtx,
          magic_link_url: actionLink,
        });
        try {
          await resend.emails.send({
            from: EMAIL_FROM,
            to: validInput.customer.email,
            subject: claim.subject,
            text: claim.text,
            html: claim.html,
          });
        } catch (err) {
          console.error("[submitOrder] account-claim email send failed:", err);
        }
      } else {
        console.warn(
          "[submitOrder] Resend not configured; account-claim link generated but not emailed:",
          { order_id, email: validInput.customer.email },
        );
      }
    }
  } catch (err) {
    console.error("[submitOrder] account-claim link generation failed:", err);
    // Best-effort: do NOT fail the order on auth-admin error.
  }

  // NOWPayments crypto invoice — runs UNCONDITIONALLY when the order is
  // crypto, regardless of Resend. NP only needs its own API key; the
  // hosted-link email is sent if Resend is up, but the invoice URL
  // persists on the order row so the customer can find it on
  // /account/orders/[id] either way.
  if (payment_method === "crypto") {
    try {
      const orderItems = resolved.items as { name: string; quantity: number }[];
      const description =
        orderItems
          .slice(0, 3)
          .map((i) => `${i.name} ×${i.quantity}`)
          .join(", ") || `Order ${order_id.slice(0, 8)}`;
      const inv = await createNowpaymentsInvoice({
        order_id,
        order_description: description,
        amount_usd: finalTotalCents / 100,
      });
      if (inv.ok) {
        await supa
          .from("orders")
          .update({
            nowpayments_invoice_id: inv.invoice_id,
            nowpayments_invoice_url: inv.invoice_url,
          })
          .eq("order_id", order_id);
        if (resend) {
          await sendCryptoPaymentLink(
            { ...row, total_cents: finalTotalCents } as unknown as OrderRow,
            inv.invoice_url,
          );
        }
      } else {
        console.error(
          "[submitOrder] NOWPayments invoice creation failed:",
          inv.reason,
        );
      }
    } catch (err) {
      console.error("[submitOrder] NOWPayments path threw:", err);
    }
  }

  // Sprint 3 Task 9 — referral attribution. If the request has a bgp_ref
  // cookie, link this order to the referral. Self-referral and repeat-buyer
  // guards live inside claimReferralOnOrder. Best-effort — never block
  // the order.
  //
  // Stacking policy: when subscription_mode is set, the subscription
  // discount wins (already applied via createSubscription) and the
  // referral 10% does not stack. When subscription_mode is null AND a
  // referral cookie is present, we apply the 10% via a compensating
  // UPDATE on the order's discount_cents / total_cents.
  try {
    if (!validInput.subscription_mode) {
      const cookieHeader = headerBag.get("cookie");
      const attribution = parseReferralCookie(cookieHeader);
      if (attribution) {
        const result = await claimReferralOnOrder({
          customer_email: validInput.customer.email,
          cookie_code: attribution.code,
          order_id,
        });
        if (result.ok && result.ten_percent_off_applied) {
          // Compose referral on top of any existing discount/total
          // (Stack & Save, same-SKU, affiliate). Earlier code REPLACED
          // these — wiping the customer's stacked discounts.
          const { data: current, error: readErr } = await supa
            .from("orders")
            .select("discount_cents, total_cents, subtotal_cents")
            .eq("order_id", order_id)
            .maybeSingle();
          if (readErr || !current) {
            console.error(
              "[submitOrder] referral discount read failed:",
              readErr,
            );
          } else {
            const readDiscount =
              typeof current.discount_cents === "number"
                ? current.discount_cents
                : 0;
            const readTotal =
              typeof current.total_cents === "number"
                ? current.total_cents
                : resolved.subtotal_cents;
            const composed = composeReferralDiscount({
              subtotal_cents:
                typeof current.subtotal_cents === "number"
                  ? current.subtotal_cents
                  : resolved.subtotal_cents,
              current_discount_cents: readDiscount,
              current_total_cents: readTotal,
            });
            // Optimistic concurrency: the UPDATE only succeeds if
            // discount_cents AND total_cents still equal what we just
            // read. If anything changed in between (admin edit,
            // affiliate apply, etc.) we abort rather than overwrite
            // with stale composed values.
            const { data: updRows, error: discountErr } = await supa
              .from("orders")
              .update({
                discount_cents: composed.next_discount_cents,
                total_cents: composed.next_total_cents,
              })
              .eq("order_id", order_id)
              .eq("discount_cents", readDiscount)
              .eq("total_cents", readTotal)
              .select("order_id");
            if (discountErr) {
              console.error(
                "[submitOrder] referral discount apply failed:",
                discountErr,
              );
            } else if (!updRows || updRows.length === 0) {
              // Lost the race — values shifted between SELECT and
              // UPDATE. Best-effort: log and move on. The customer's
              // referral attribution is recorded via claimReferralOnOrder
              // already; only the cents adjustment was lost.
              console.warn(
                "[submitOrder] referral discount apply skipped — concurrent update on order",
                order_id,
              );
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[submitOrder] referral hook threw:", err);
    // Best-effort — never propagate.
  }

  // Coupon redemption — runs LAST so the best-of comparison sees the
  // post-referral / post-Stack&Save discount. Coupon does NOT stack;
  // it replaces the existing discount stack only if it would save the
  // customer more money.
  //
  // Delegated to the `redeem_coupon` Postgres RPC so the entire
  // sequence (validity check → cap check → redemption insert → order
  // total update) runs in a single transaction with the coupon row
  // locked FOR UPDATE. Closes the race conditions the prior app-side
  // flow had with concurrent redemptions and TOCTOU expiry.
  let couponApplied: number | null = null;
  if (validInput.coupon_code) {
    try {
      const code = validInput.coupon_code.trim().toLowerCase();
      const emailLower = validInput.customer.email.trim().toLowerCase();
      const { data: applied, error: rpcErr } = await supa.rpc("redeem_coupon", {
        p_code: code,
        p_order_id: order_id,
        p_customer_email_lower: emailLower,
      });
      if (rpcErr) {
        console.error("[submitOrder] redeem_coupon rpc failed:", rpcErr);
      } else if (applied === null) {
        // Coupon didn't apply — either invalid, capped, expired, or
        // lost the best-of comparison. The Postgres function logs the
        // specific reason via RAISE NOTICE.
        console.warn(
          `[submitOrder] coupon ${code} did not apply for order ${order_id}`,
        );
      } else {
        couponApplied = typeof applied === "number" ? applied : 0;
      }
    } catch (err) {
      console.error("[submitOrder] coupon apply threw:", err);
    }
  }

  // FIRST250 launch-cohort perks. The coupon engine has already
  // applied a baseline 10% off; here we layer the tier overrides
  // and write the cohort markers. Best-effort throughout: failures
  // log and the order proceeds.
  //
  //   • Subtotal ≥ $250  → bump effective discount to 30%
  //   • 3-month prepay sub → override to 18% (replaces tier above)
  //   • 6-month prepay sub → override to 25%
  //   • Subtotal ≥ $500  → free vial of customer's choice
  //   • Cohort member    → lifetime-free-shipping ledger entry
  const FIRST_250_FREE_VIAL_THRESHOLD_CENTS = 50_000;
  const FIRST_250_HIGH_TIER_THRESHOLD_CENTS = 25_000;
  const isFirst250 =
    couponApplied !== null &&
    validInput.coupon_code?.toLowerCase() === "first250";
  if (isFirst250) {
    // Resolve the highest-applicable tier percent. Subscription
    // prepay tiers REPLACE the cart-size tier (per the launch spec
    // — they're a different reward axis).
    const subPrepayMonths =
      validInput.subscription_mode?.payment_cadence === "prepay"
        ? validInput.subscription_mode?.duration_months
        : null;
    let tierPercent = 10;
    if (subPrepayMonths === 6) tierPercent = 25;
    else if (subPrepayMonths === 3) tierPercent = 18;
    else if (totals.subtotal_cents >= FIRST_250_HIGH_TIER_THRESHOLD_CENTS)
      tierPercent = 30;

    // The base coupon already deducted 10% via the redeem_coupon RPC.
    // If the resolved tier is higher, we need to deduct the extra
    // percent from the order total directly. We compute the delta
    // off of the pre-coupon subtotal so the math is independent of
    // any other discount stack.
    let firstFiftyExtraDiscountCents = 0;
    if (tierPercent > 10) {
      const extraPct = tierPercent - 10;
      firstFiftyExtraDiscountCents = Math.round(
        (totals.subtotal_cents * extraPct) / 100,
      );
    }

    const adjustedTotal = Math.max(
      0,
      finalTotalCents - firstFiftyExtraDiscountCents,
    );
    const adjustedDiscountCents =
      discount_cents + firstFiftyExtraDiscountCents;

    const freeVialQualifies =
      totals.subtotal_cents >= FIRST_250_FREE_VIAL_THRESHOLD_CENTS &&
      !!validInput.first_time_vial_sku;

    try {
      await supa
        .from("orders")
        .update({
          first_250_member: true,
          total_cents: adjustedTotal,
          discount_cents: adjustedDiscountCents,
          ...(freeVialQualifies
            ? {
                first_vial_free_sku: validInput.first_time_vial_sku,
                free_vial_count: 1,
              }
            : {}),
        })
        .eq("order_id", order_id);
    } catch (err) {
      console.error("[submitOrder] FIRST250 perk write failed:", err);
    }

    // Lifetime-free-shipping ledger. Idempotent: a returning cohort
    // member who somehow re-uses FIRST250 (shouldn't happen — the
    // per-email cap is 1) just hits the ON CONFLICT no-op.
    try {
      const emailLower = validInput.customer.email.trim().toLowerCase();
      await supa.from("lifetime_free_shipping").upsert(
        {
          email_lower: emailLower,
          qualified_via: "first250",
          qualified_order_id: order_id,
        },
        { onConflict: "email_lower", ignoreDuplicates: true },
      );
    } catch (err) {
      console.error("[submitOrder] FIRST250 lifetime-shipping write failed:", err);
    }
  }

  // FOUNDER perk — fallback launch coupon. The base coupon engine
  // already deducted 25% off via the redeem_coupon RPC, BUT we gate
  // the apply on the cart having 3+ peptide vials. If the gate
  // fails here we don't refund (the RPC already wrote the
  // redemption row + adjusted the order total). Instead we surface
  // the requirement at coupon-preview time so the customer never
  // submits an order that wouldn't have qualified.
  //
  // Free vials:
  //   • Subtotal >= $1000 → 2 free vials
  //   • Subtotal >= $500  → 1 free vial
  // Customer-chosen SKU is the existing first_time_vial_sku field;
  // for the count-2 tier fulfillment ships two of that SKU (admin
  // can swap if the customer requests a different second pick).
  const FOUNDER_MIN_VIAL_QTY = 3;
  const FOUNDER_TWO_FREE_VIAL_THRESHOLD_CENTS = 100_000;
  const FOUNDER_ONE_FREE_VIAL_THRESHOLD_CENTS = 50_000;
  const isFounder =
    couponApplied !== null &&
    validInput.coupon_code?.toLowerCase() === "founder";
  if (isFounder) {
    const totalVialQty = resolved.items
      .filter((i) => !("is_supply" in i && i.is_supply))
      .reduce((sum, i) => sum + i.quantity, 0);
    if (totalVialQty < FOUNDER_MIN_VIAL_QTY) {
      // Edge case: redeem_coupon doesn't know about the 3-vial gate
      // (it's an application-layer rule), so a customer with a
      // 1-vial cart could in theory get the discount applied. Log
      // it; admin can review & follow up.
      console.warn(
        `[submitOrder] FOUNDER applied to order ${order_id} with only ${totalVialQty} vial(s) — gate enforced at preview but bypassed at submit; admin review.`,
      );
    } else {
      let freeVialCount = 0;
      if (totals.subtotal_cents >= FOUNDER_TWO_FREE_VIAL_THRESHOLD_CENTS) {
        freeVialCount = 2;
      } else if (totals.subtotal_cents >= FOUNDER_ONE_FREE_VIAL_THRESHOLD_CENTS) {
        freeVialCount = 1;
      }
      if (freeVialCount > 0 && validInput.first_time_vial_sku) {
        try {
          await supa
            .from("orders")
            .update({
              free_vial_count: freeVialCount,
              first_vial_free_sku: validInput.first_time_vial_sku,
            })
            .eq("order_id", order_id);
        } catch (err) {
          console.error("[submitOrder] FOUNDER free-vial write failed:", err);
        }
      }
    }
  }

  // Backfill the prelaunch_signups row so we can correlate waitlist
  // signups → first orders (for marketing reporting + winner-pick on
  // the giveaway). Best-effort.
  try {
    const emailLower = validInput.customer.email.trim().toLowerCase();
    await supa
      .from("prelaunch_signups")
      .update({ first_order_id: order_id })
      .eq("email_lower", emailLower)
      .is("first_order_id", null);
  } catch (err) {
    console.error("[submitOrder] prelaunch backfill failed:", err);
  }

  return { ok: true, order_id, success_token: makeSuccessToken(order_id) };
}
