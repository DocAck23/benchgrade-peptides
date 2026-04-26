"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { RUO_STATEMENTS } from "@/lib/compliance";
import { PRODUCTS } from "@/lib/catalog/data";
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
import { claimReferralOnOrder } from "@/app/actions/referrals";
import { createServerSupabase } from "@/lib/supabase/client";
import {
  personalVialDiscount,
  type AffiliateTier,
} from "@/lib/affiliate/tiers";

// Dev-only fallback store — in prod we require Supabase-backed counting.
const devMemoryStore = new MemoryRateLimitStore();

const CERTIFICATION_VERSION = "2026-04-22";

// Whitelist of valid US state + territory + military-mail 2-letter codes.
// Anything outside this set is rejected at checkout — keeps the address
// field from accepting `ZZ` or similar bogus 2-letter strings.
const US_STATES_AND_TERRITORIES = new Set<string>([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC","PR","GU","VI","AS","MP","AA","AE","AP",
]);

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
}

export interface SubmitOrderResult {
  ok: boolean;
  order_id?: string;
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
    const match = PRODUCTS.find((p) => p.variants.some((v) => v.sku === line.sku));
    const variant = match?.variants.find((v) => v.sku === line.sku);
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
    });
    subtotal_cents += Math.round(variant.retail_price * 100) * qty;
  }
  return { items, subtotal_cents };
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

  const finalTotalCents = totals.total_cents - affiliateDiscountCents;
  const discount_cents =
    totals.subtotal_cents - totals.total_cents + affiliateDiscountCents;

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
    return { ok: true, order_id };
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
  if (resend) {
    const emailCtx = {
      order_id,
      customer: validInput.customer,
      items: resolved.items,
      subtotal_cents: resolved.subtotal_cents,
      payment_method,
    };
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

    // Sprint 1 Task 9 — account-claim email. We generate a single-use
    // magic link via Supabase admin so the customer can transition from
    // guest to authenticated user with one click. If an auth.users row
    // already exists for this email, generateLink emits a sign-in link
    // for that existing account (no duplicate user is created); if not,
    // it provisions one. Best-effort: any failure here logs and falls
    // through — the order is durable regardless.
    try {
      const { data: linkData } = await supa.auth.admin.generateLink({
        type: "magiclink",
        email: validInput.customer.email,
        options: { redirectTo: `${SITE_URL}/auth/callback?next=/account` },
      });
      const actionLink = linkData?.properties?.action_link;
      // Defense-in-depth: explicitly assert https scheme before passing
      // the URL into an email template. escapeHtml() in editorialEmailHtml
      // handles attribute escaping, but a non-https value (javascript:,
      // data:, http:) would survive escaping and remain clickable.
      // Supabase admin.generateLink always returns https in normal flow;
      // this guards against any future regression.
      if (actionLink && actionLink.startsWith("https://")) {
        const claim = accountClaimEmail({
          ...emailCtx,
          magic_link_url: actionLink,
        });
        await resend.emails.send({
          from: EMAIL_FROM,
          to: validInput.customer.email,
          subject: claim.subject,
          text: claim.text,
          html: claim.html,
        });
      }
    } catch (err) {
      console.error("[submitOrder] account-claim email failed:", err);
      // Best-effort: do NOT fail the order on email/auth-admin error.
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
          const refDiscount = Math.round(resolved.subtotal_cents * 0.1);
          const refTotal = resolved.subtotal_cents - refDiscount;
          const { error: discountErr } = await supa
            .from("orders")
            .update({
              discount_cents: refDiscount,
              total_cents: refTotal,
            })
            .eq("order_id", order_id);
          if (discountErr) {
            console.error(
              "[submitOrder] referral discount apply failed:",
              discountErr
            );
          }
        }
      }
    }
  } catch (err) {
    console.error("[submitOrder] referral hook threw:", err);
    // Best-effort — never propagate.
  }

  return { ok: true, order_id };
}
