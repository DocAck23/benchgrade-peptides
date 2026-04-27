import type { CartItem } from "./types";
import { subscriptionDiscountPercent } from "@/lib/subscriptions/discounts";

export interface SubscriptionModeForCart {
  duration_months: 1 | 3 | 6 | 9 | 12;
  payment_cadence: "prepay" | "bill_pay";
  ship_cadence: "monthly" | "quarterly" | "once";
}

export interface CheckoutCartTotals extends CartTotals {
  subscription_discount_percent: number;
  subscription_discount_cents: number;
}

export interface StackSaveResult {
  tier_percent: 0 | 15 | 20 | 25 | 28;
  free_shipping: boolean;
  free_vial_size_mg: 5 | 10 | null;
  vial_count: number;
}

export interface NextTierInfo {
  target: number;
  message: string;
  progress_pct: number;
}

export interface CartTotals {
  subtotal_cents: number;
  vial_count: number;
  stack_save_tier_percent: number;
  stack_save_discount_cents: number;
  same_sku_multiplier_percent: 0 | 5;
  same_sku_discount_cents: number;
  free_shipping: boolean;
  free_vial_entitlement: { size_mg: 5 | 10 } | null;
  total_cents: number;
}

function vialCount(items: CartItem[]): number {
  // Bundle supplies (BAC water, syringes, draw needles) are not vials —
  // they shouldn't shift Stack & Save tier or the same-SKU multiplier.
  return items
    .filter((i) => !i.is_supply)
    .reduce((n, i) => n + i.quantity * i.pack_size, 0);
}

/**
 * Per-line subtotal in cents. Supply lines apply first-unit-free pricing
 * (qty - 1) so a single BAC water + 1 of each syringe pack are bundled
 * with every order at no charge; additional units charge full price.
 */
export function lineSubtotalCents(item: CartItem): number {
  const billableQty = item.is_supply
    ? Math.max(0, item.quantity - 1)
    : item.quantity;
  return Math.round(item.unit_price * billableQty * 100);
}

export function computeStackSaveDiscount(items: CartItem[]): StackSaveResult {
  const vc = vialCount(items);
  if (vc >= 12) return { tier_percent: 28, free_shipping: true, free_vial_size_mg: 10, vial_count: vc };
  if (vc >= 8)  return { tier_percent: 25, free_shipping: true, free_vial_size_mg: 5, vial_count: vc };
  if (vc >= 5)  return { tier_percent: 20, free_shipping: true, free_vial_size_mg: null, vial_count: vc };
  if (vc >= 3)  return { tier_percent: 15, free_shipping: true, free_vial_size_mg: null, vial_count: vc };
  if (vc >= 2)  return { tier_percent: 0,  free_shipping: true, free_vial_size_mg: null, vial_count: vc };
  return { tier_percent: 0, free_shipping: false, free_vial_size_mg: null, vial_count: vc };
}

export function nextStackSaveTier(vials: number): NextTierInfo | null {
  const tiers: Array<{ at: number; msg: string }> = [
    { at: 2,  msg: 'Add %d more vial%s — unlock free domestic shipping' },
    { at: 3,  msg: 'Add %d more vial%s — unlock 15%% off the order' },
    { at: 5,  msg: 'Add %d more vial%s — unlock 20%% off the order' },
    { at: 8,  msg: 'Add %d more vial%s — unlock 25%% off + a free 5mg vial of choice' },
    { at: 12, msg: 'Add %d more vial%s — unlock 28%% off + a free 10mg vial of choice' },
  ];
  for (const tier of tiers) {
    if (vials < tier.at) {
      const need = tier.at - vials;
      return {
        target: tier.at,
        message: tier.msg
          .replace('%d', String(need))
          .replace('%s', need === 1 ? '' : 's')
          .replace('%%', '%'),
        progress_pct: Math.round((vials / tier.at) * 100),
      };
    }
  }
  return null;
}

export function computeSameSkuMultiplier(items: CartItem[]): 0 | 5 {
  const counts = new Map<string, number>();
  for (const i of items) {
    if (i.is_supply) continue; // supplies don't trip the multiplier
    counts.set(i.sku, (counts.get(i.sku) ?? 0) + i.quantity * i.pack_size);
  }
  for (const c of counts.values()) {
    if (c >= 5) return 5;
  }
  return 0;
}

export function computeCartTotals(items: CartItem[]): CartTotals {
  // Per-line subtotal: supplies use first-unit-free pricing.
  const subtotal_cents = items.reduce(
    (s, i) => s + lineSubtotalCents(i),
    0,
  );
  // Stack & Save / same-SKU discounts apply only to peptide vials —
  // supplies are billed flat at the (already-discounted-by-1) price.
  const peptide_subtotal_cents = items
    .filter((i) => !i.is_supply)
    .reduce((s, i) => s + Math.round(i.unit_price * i.quantity * 100), 0);
  const ss = computeStackSaveDiscount(items);
  const stack_save_discount_cents = Math.round(peptide_subtotal_cents * (ss.tier_percent / 100));
  const post_stack = peptide_subtotal_cents - stack_save_discount_cents;
  const sameSku = computeSameSkuMultiplier(items);
  const same_sku_discount_cents = Math.round(post_stack * (sameSku / 100));
  return {
    subtotal_cents,
    vial_count: ss.vial_count,
    stack_save_tier_percent: ss.tier_percent,
    stack_save_discount_cents,
    same_sku_multiplier_percent: sameSku,
    same_sku_discount_cents,
    free_shipping: ss.free_shipping,
    free_vial_entitlement: ss.free_vial_size_mg ? { size_mg: ss.free_vial_size_mg } : null,
    // Total = (peptide subtotal - stack-save - same-sku) + supplies-portion
    // where supplies-portion is already first-unit-free in subtotal_cents.
    total_cents:
      subtotal_cents - stack_save_discount_cents - same_sku_discount_cents,
  };
}

/**
 * Cart totals when subscription mode is active. The subscription discount
 * REPLACES the Stack & Save tier (per spec §E — subscription discount is
 * strictly larger). The same-SKU multiplier still stacks on top of the
 * post-subscription total. When `subscriptionMode` is null, the result is
 * value-equivalent to `computeCartTotals` (with the two new subscription
 * fields set to 0).
 */
export function computeCartTotalsForCheckout(
  items: CartItem[],
  subscriptionMode: SubscriptionModeForCart | null,
): CheckoutCartTotals {
  const base = computeCartTotals(items);

  if (subscriptionMode === null) {
    return {
      ...base,
      subscription_discount_percent: 0,
      subscription_discount_cents: 0,
    };
  }

  const subPct = subscriptionDiscountPercent(subscriptionMode);
  if (subPct <= 0) {
    // Invalid combo — fall back to base totals.
    return {
      ...base,
      subscription_discount_percent: 0,
      subscription_discount_cents: 0,
    };
  }

  const subtotal_cents = base.subtotal_cents;
  const subscription_discount_cents = Math.round((subtotal_cents * subPct) / 100);
  const post_sub = subtotal_cents - subscription_discount_cents;
  const sameSku = computeSameSkuMultiplier(items);
  const same_sku_discount_cents = Math.round((post_sub * sameSku) / 100);

  return {
    subtotal_cents,
    vial_count: base.vial_count,
    // Subscription replaces Stack & Save — zero out the tier fields so
    // the order summary doesn't double-count.
    stack_save_tier_percent: 0,
    stack_save_discount_cents: 0,
    same_sku_multiplier_percent: sameSku,
    same_sku_discount_cents,
    free_shipping: base.free_shipping,
    free_vial_entitlement: base.free_vial_entitlement,
    total_cents: post_sub - same_sku_discount_cents,
    subscription_discount_percent: subPct,
    subscription_discount_cents,
  };
}
