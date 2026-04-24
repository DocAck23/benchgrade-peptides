"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { RUO_STATEMENTS } from "@/lib/compliance";
import { PRODUCTS } from "@/lib/catalog/data";
import type { CartItem } from "@/lib/cart/types";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getResend, EMAIL_FROM, ADMIN_NOTIFICATION_EMAIL } from "@/lib/email/client";
import { orderConfirmationEmail, adminOrderNotification } from "@/lib/email/templates";
import { SupabaseRateLimitStore } from "@/lib/ratelimit/supabase-store";
import { MemoryRateLimitStore } from "@/lib/ratelimit/memory-store";
import { enforceOrderRateLimit } from "@/lib/ratelimit/enforce";
import { resolveClientIp } from "@/lib/ratelimit/ip";
import {
  PAYMENT_METHODS,
  enabledPaymentMethods,
  type PaymentMethod,
} from "@/lib/payments/methods";

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

export interface SubmitOrderInput {
  customer: CustomerInfo;
  items: ClientCartLine[];
  acknowledgment: ClientAcknowledgment;
  payment_method: PaymentMethod;
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

const SubmitOrderSchema = z.object({
  customer: CustomerSchema,
  items: z.array(CartLineSchema).min(1, "Cart is empty.").max(20, "Cart too large."),
  acknowledgment: AcknowledgmentSchema,
  payment_method: PaymentMethodSchema,
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
    subtotal_cents: resolved.subtotal_cents,
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
  }

  return { ok: true, order_id };
}
