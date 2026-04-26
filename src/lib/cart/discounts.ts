import type { CartItem } from "./types";

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
  return items.reduce((n, i) => n + i.quantity * i.pack_size, 0);
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
    counts.set(i.sku, (counts.get(i.sku) ?? 0) + i.quantity * i.pack_size);
  }
  for (const c of counts.values()) {
    if (c >= 5) return 5;
  }
  return 0;
}

export function computeCartTotals(items: CartItem[]): CartTotals {
  const subtotal_cents = Math.round(items.reduce((s, i) => s + i.unit_price * i.quantity * 100, 0));
  const ss = computeStackSaveDiscount(items);
  const stack_save_discount_cents = Math.round(subtotal_cents * (ss.tier_percent / 100));
  const post_stack = subtotal_cents - stack_save_discount_cents;
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
    total_cents: post_stack - same_sku_discount_cents,
  };
}
