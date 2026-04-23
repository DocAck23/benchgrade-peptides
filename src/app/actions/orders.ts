"use server";

import crypto from "node:crypto";
import { headers } from "next/headers";
import { RUO_STATEMENTS } from "@/lib/compliance";
import { PRODUCTS } from "@/lib/catalog/data";
import type { CartItem } from "@/lib/cart/types";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getResend, EMAIL_FROM, ADMIN_NOTIFICATION_EMAIL } from "@/lib/email/client";
import { orderConfirmationEmail, adminOrderNotification } from "@/lib/email/templates";
import { SupabaseRateLimitStore } from "@/lib/ratelimit/supabase-store";
import { MemoryRateLimitStore } from "@/lib/ratelimit/memory-store";
import { enforceOrderRateLimit } from "@/lib/ratelimit/enforce";

// Dev-only fallback store — in prod we require Supabase-backed counting.
const devMemoryStore = new MemoryRateLimitStore();

const CERTIFICATION_VERSION = "2026-04-22";

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
}

export interface SubmitOrderResult {
  ok: boolean;
  order_id?: string;
  error?: string;
}

function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function validateCustomer(c: CustomerInfo): string | null {
  if (!c.name?.trim()) return "Name is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email)) return "Valid email is required.";
  if (!c.ship_address_1?.trim()) return "Shipping address is required.";
  if (!c.ship_city?.trim()) return "City is required.";
  if (!c.ship_state?.trim()) return "State is required.";
  if (!/^\d{5}(-\d{4})?$/.test(c.ship_zip.trim())) return "ZIP code is invalid.";
  return null;
}

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
  const ip =
    headerBag.get("x-vercel-forwarded-for") ??
    headerBag.get("x-real-ip") ??
    headerBag.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const userAgent = headerBag.get("user-agent") ?? "unknown";

  // Fail closed on unidentifiable clients in prod — the "unknown" bucket
  // would otherwise collapse every anonymous caller into one shared
  // counter, letting any one of them lock everyone else out.
  if (ip === "unknown" && process.env.NODE_ENV === "production") {
    return { ok: false, error: "Could not identify request source. Please try again." };
  }

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

  const customerError = validateCustomer(input.customer);
  if (customerError) return { ok: false, error: customerError };

  const { acknowledgment } = input;
  if (!acknowledgment?.is_adult || !acknowledgment.is_researcher || !acknowledgment.accepts_ruo) {
    return { ok: false, error: "RUO certification is required." };
  }

  const resolved = resolveCartOnServer(input.items);
  if ("error" in resolved) return { ok: false, error: resolved.error };

  // Certification text + timestamp are stamped from server-side constants,
  // not from the client. The stored hash covers both so any later
  // text revision has a clean version boundary.
  const certification_text = RUO_STATEMENTS.certification;
  const acknowledged_at = new Date().toISOString();
  const certification_hash = sha256Hex(`${CERTIFICATION_VERSION}:${certification_text}`);

  const order_id = crypto.randomUUID();
  const row = {
    order_id,
    customer: input.customer,
    items: resolved.items,
    subtotal_cents: resolved.subtotal_cents,
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
    status: "awaiting_wire" as const,
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
    // If the mirror failed we've shipped an order without a standalone
    // compliance row — surface the error so ops can reconcile rather
    // than silently log it.
    return {
      ok: false,
      error: `RUO acknowledgment mirror failed: ${ackError.message}. Contact support.`,
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
      customer: input.customer,
      items: resolved.items,
      subtotal_cents: resolved.subtotal_cents,
    };
    const customerEmail = orderConfirmationEmail(emailCtx);
    const adminEmail = adminOrderNotification(emailCtx);
    try {
      await Promise.all([
        resend.emails.send({
          from: EMAIL_FROM,
          to: input.customer.email,
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
