"use server";

/**
 * Referral server actions (Sprint 3 Wave B1).
 *
 *   generateMyReferralCode    — auth-gated mint, idempotent (returns existing).
 *   claimReferralOnOrder      — called from inside submitOrder when the
 *                               bgp_ref cookie is present. Service-role
 *                               only, best-effort, never throws to caller.
 *   redeemFreeVialEntitlement — atomic UPDATE; cookie-scoped (RLS owns the
 *                               authorization gate).
 *
 * Security boundary:
 *   - Cookie-scoped client → user-driven flows where RLS = authority.
 *   - Service-role client  → flows where RLS deny-by-default would block
 *     the legitimate write (insert into referral_codes; insert into
 *     referrals from a server action that may be running pre-claim with
 *     no auth.uid() = order owner).
 */

import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase/client";
import { getSupabaseServer } from "@/lib/supabase/server";
import { generateReferralCode, validateReferralCode } from "@/lib/referrals/codes";
import { PRODUCTS } from "@/lib/catalog/data";

// ---------------------------------------------------------------------------
// generateMyReferralCode
// ---------------------------------------------------------------------------

export interface GenerateMyReferralCodeResult {
  ok: boolean;
  code?: string;
  error?: string;
}

export async function generateMyReferralCode(): Promise<GenerateMyReferralCodeResult> {
  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  // Idempotent: if the user already has a code, hand it back.
  const { data: existing } = await supa
    .from("referral_codes")
    .select("code, owner_user_id")
    .eq("owner_user_id", user.id)
    .maybeSingle();
  if (existing && (existing as { code?: string }).code) {
    return { ok: true, code: (existing as { code: string }).code };
  }

  // Mint via service-role client — RLS denies INSERT to anon/auth roles
  // by default, so we cannot use the cookie-scoped client here. The
  // service-role bypass is gated by the auth.uid() check above.
  const service = getSupabaseServer();
  if (!service) return { ok: false, error: "Database unavailable." };

  // Collision retry: generated alphabet is large enough that a clash is
  // statistically rare, but we still loop on the unique-constraint
  // violation up to 5 times before giving up.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    const { error } = await service
      .from("referral_codes")
      .insert({ code, owner_user_id: user.id });
    if (!error) return { ok: true, code };
    // 23505 = unique violation; anything else we surface immediately.
    const msg = String((error as { message?: string }).message ?? "");
    if (!msg.toLowerCase().includes("duplicate") && !msg.includes("23505")) {
      return { ok: false, error: msg || "Insert failed." };
    }
  }
  return { ok: false, error: "Could not allocate a unique referral code." };
}

// ---------------------------------------------------------------------------
// claimReferralOnOrder
// ---------------------------------------------------------------------------

export interface ClaimReferralOnOrderInput {
  customer_email: string;
  cookie_code: string | null;
  order_id: string;
}

export interface ClaimReferralOnOrderResult {
  ok: boolean;
  ten_percent_off_applied?: boolean;
  error?: string;
}

/**
 * Attribute an order to a referral code (best-effort).
 *
 * Always returns `{ ok: true, ten_percent_off_applied: false }` when a
 * guard fails — the caller (`submitOrder`) treats this as "no discount,
 * no row" rather than an error. We never propagate failure to the order
 * because a referral mishap must NEVER block a paid order from landing.
 */
export async function claimReferralOnOrder(
  input: ClaimReferralOnOrderInput
): Promise<ClaimReferralOnOrderResult> {
  if (!input.cookie_code) {
    return { ok: true, ten_percent_off_applied: false };
  }
  if (!validateReferralCode(input.cookie_code)) {
    return { ok: true, ten_percent_off_applied: false };
  }

  const service = getSupabaseServer();
  if (!service) return { ok: true, ten_percent_off_applied: false };

  // Look up the code → owner. Unknown code = silent no-op.
  const { data: codeRow } = await service
    .from("referral_codes")
    .select("code, owner_user_id")
    .eq("code", input.cookie_code)
    .maybeSingle();
  if (!codeRow) return { ok: true, ten_percent_off_applied: false };
  const ownerId = (codeRow as { owner_user_id: string }).owner_user_id;

  // Self-referral guard: case-insensitive email compare against the
  // owner's auth.users row.
  try {
    const { data: ownerUser } = await service.auth.admin.getUserById(ownerId);
    const ownerEmail = (ownerUser?.user?.email ?? "").trim().toLowerCase();
    const refereeEmail = input.customer_email.trim().toLowerCase();
    if (ownerEmail && ownerEmail === refereeEmail) {
      return { ok: true, ten_percent_off_applied: false };
    }
  } catch {
    // If we can't resolve the owner email, fail closed (no discount).
    return { ok: true, ten_percent_off_applied: false };
  }

  // First-time-buyer guard: count of prior orders for this email,
  // case-insensitive against `customer->>'email'`.
  const refereeEmailLower = input.customer_email.trim().toLowerCase();
  const { data: priorOrders } = await service
    .from("orders")
    .select("order_id")
    .ilike("customer->>email", refereeEmailLower);
  if (Array.isArray(priorOrders) && priorOrders.length > 0) {
    return { ok: true, ten_percent_off_applied: false };
  }

  // Insert the referral row — service-role because the referee's
  // auth.uid() is null at order time (claim happens later via magic link).
  const { error: insertErr } = await service.from("referrals").insert({
    referrer_user_id: ownerId,
    referee_user_id: null,
    referee_email: refereeEmailLower,
    code: input.cookie_code,
    status: "pending",
    first_order_id: input.order_id,
  });
  if (insertErr) {
    // Best-effort: do not block the order if the referral insert fails.
    console.error("[claimReferralOnOrder] referral insert failed:", insertErr);
    return { ok: true, ten_percent_off_applied: false };
  }
  return { ok: true, ten_percent_off_applied: true };
}

// ---------------------------------------------------------------------------
// redeemFreeVialEntitlement
// ---------------------------------------------------------------------------

export interface RedeemFreeVialEntitlementInput {
  entitlement_id: string;
  selected_sku: string;
  order_id: string;
}

export interface RedeemFreeVialEntitlementResult {
  ok: boolean;
  error?: string;
}

function findVariantSizeMg(sku: string): number | null {
  for (const p of PRODUCTS) {
    const v = p.variants.find((v) => v.sku === sku);
    if (v) return v.size_mg;
  }
  return null;
}

/**
 * Atomic redemption of a free-vial entitlement:
 *   UPDATE free_vial_entitlements
 *      SET status='redeemed', redeemed_at=now(), redeemed_order_id=$order
 *    WHERE id = $entitlement_id
 *      AND customer_user_id = auth.uid()    (enforced by RLS)
 *      AND status = 'available'
 *
 * The status filter makes the operation idempotent — a duplicate click
 * yields rowcount=0, returned as a clean "not available" error.
 *
 * We also server-validate that `selected_sku` actually maps to a vial
 * matching the entitlement's `size_mg` so a hostile client can't redeem
 * a 5mg entitlement for a 10mg product.
 */
export async function redeemFreeVialEntitlement(
  input: RedeemFreeVialEntitlementInput
): Promise<RedeemFreeVialEntitlementResult> {
  if (!z.string().uuid().safeParse(input.entitlement_id).success) {
    return { ok: false, error: "Invalid entitlement id." };
  }
  if (!z.string().uuid().safeParse(input.order_id).success) {
    return { ok: false, error: "Invalid order id." };
  }

  const supa = await createServerSupabase();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) return { ok: false, error: "Please sign in." };

  // Verify the entitlement exists and the chosen SKU's size_mg matches.
  // RLS scopes the SELECT to the current auth.uid().
  const { data: ent } = await supa
    .from("free_vial_entitlements")
    .select("id, size_mg, status")
    .eq("id", input.entitlement_id)
    .maybeSingle();
  if (!ent) return { ok: false, error: "Entitlement not available." };
  const skuSize = findVariantSizeMg(input.selected_sku);
  if (skuSize === null) {
    return { ok: false, error: "Unknown SKU." };
  }
  if (skuSize !== (ent as { size_mg: number }).size_mg) {
    return {
      ok: false,
      error: "Selected vial size does not match entitlement.",
    };
  }

  const redeemedAt = new Date().toISOString();
  const { data, error } = await supa
    .from("free_vial_entitlements")
    .update({
      status: "redeemed",
      redeemed_at: redeemedAt,
      redeemed_order_id: input.order_id,
    })
    .eq("id", input.entitlement_id)
    .eq("customer_user_id", user.id)
    .eq("status", "available")
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Entitlement not available." };
  }
  return { ok: true };
}
