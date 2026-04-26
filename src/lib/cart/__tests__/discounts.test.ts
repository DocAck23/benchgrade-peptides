import { describe, it, expect } from "vitest";
import {
  computeStackSaveDiscount,
  nextStackSaveTier,
  computeSameSkuMultiplier,
  computeCartTotals,
  computeCartTotalsForCheckout,
} from "../discounts";
import type { CartItem } from "../types";

function vial(sku: string, price: number, qty: number = 1): CartItem {
  return {
    sku, product_slug: 'p', category_slug: 'c', name: sku,
    size_mg: 10, pack_size: 1, unit_price: price, quantity: qty,
    vial_image: '',
  };
}

describe('computeStackSaveDiscount', () => {
  it('U-DISC-1: 0 vials → no tier, no free shipping', () => {
    expect(computeStackSaveDiscount([])).toEqual({
      tier_percent: 0, free_shipping: false, free_vial_size_mg: null, vial_count: 0
    });
  });
  it('U-DISC-2: 1 vial → no tier, paid shipping', () => {
    expect(computeStackSaveDiscount([vial('A',100)])).toEqual({
      tier_percent: 0, free_shipping: false, free_vial_size_mg: null, vial_count: 1
    });
  });
  it('U-DISC-3: 2 vials → free shipping, no tier %', () => {
    expect(computeStackSaveDiscount([vial('A',100,2)])).toEqual({
      tier_percent: 0, free_shipping: true, free_vial_size_mg: null, vial_count: 2
    });
  });
  it('U-DISC-4: 3 vials → 15% off + free ship', () => {
    const r = computeStackSaveDiscount([vial('A',100,3)]);
    expect(r.tier_percent).toBe(15);
    expect(r.free_shipping).toBe(true);
  });
  it('U-DISC-5: 4 vials still 15%', () => {
    expect(computeStackSaveDiscount([vial('A',100,4)]).tier_percent).toBe(15);
  });
  it('U-DISC-6: 5 vials → 20%', () => {
    expect(computeStackSaveDiscount([vial('A',100,5)]).tier_percent).toBe(20);
  });
  it('U-DISC-8: 8 vials → 25% + free 5mg vial', () => {
    const r = computeStackSaveDiscount([vial('A',100,8)]);
    expect(r.tier_percent).toBe(25);
    expect(r.free_vial_size_mg).toBe(5);
  });
  it('U-DISC-9: 12 vials → 28% + free 10mg vial', () => {
    const r = computeStackSaveDiscount([vial('A',100,12)]);
    expect(r.tier_percent).toBe(28);
    expect(r.free_vial_size_mg).toBe(10);
  });
  it('U-DISC-10: 20 vials cap at 28%', () => {
    expect(computeStackSaveDiscount([vial('A',100,20)]).tier_percent).toBe(28);
  });
});

describe('nextStackSaveTier', () => {
  it('U-DISC-11: at 1 vial, target=2', () => {
    expect(nextStackSaveTier(1)).toEqual({
      target: 2,
      message: 'Add 1 more vial — unlock free domestic shipping',
      progress_pct: 50,
    });
  });
  it('U-DISC-12: at 4 vials, target=5 (20% off)', () => {
    expect(nextStackSaveTier(4)?.target).toBe(5);
    expect(nextStackSaveTier(4)?.message).toMatch(/20%/);
  });
  it('U-DISC-13: at 12+ vials returns null', () => {
    expect(nextStackSaveTier(12)).toBeNull();
    expect(nextStackSaveTier(50)).toBeNull();
  });
});

describe('computeSameSkuMultiplier', () => {
  it('U-MULT-1: all distinct → 0%', () => {
    expect(computeSameSkuMultiplier([vial('A',100), vial('B',100), vial('C',100)])).toBe(0);
  });
  it('U-MULT-2: 4 of same → 0%', () => {
    expect(computeSameSkuMultiplier([vial('A',100,4)])).toBe(0);
  });
  it('U-MULT-3: 5 of same → 5%', () => {
    expect(computeSameSkuMultiplier([vial('A',100,5)])).toBe(5);
  });
  it('U-MULT-4: 5 of one + 3 of another → 5%', () => {
    expect(computeSameSkuMultiplier([vial('A',100,5), vial('B',100,3)])).toBe(5);
  });
  it('U-MULT-5: 5 of one + 5 of another still 5% (capped)', () => {
    expect(computeSameSkuMultiplier([vial('A',100,5), vial('B',100,5)])).toBe(5);
  });
});

describe('computeCartTotals', () => {
  it('U-COMBO-1: 5 of same SKU at $100 → subtotal 500, Stack&Save 20%, SameSKU 5%', () => {
    const t = computeCartTotals([vial('A',100,5)]);
    expect(t.subtotal_cents).toBe(50000);
    // 20% then 5% multiplicative? OR additive 25%? — Documented ORDER OF OPS:
    // first Stack&Save tier off subtotal, then SameSKU on the post-tier total.
    expect(t.stack_save_discount_cents).toBe(10000); // 20% of 50000
    expect(t.same_sku_discount_cents).toBe(2000);    // 5% of (50000-10000)
    expect(t.total_cents).toBe(50000 - 10000 - 2000);
    expect(t.free_shipping).toBe(true);
  });

  it('U-COMBO-2: 8 vials, 5 same SKU + 3 distinct → 25% Stack + 5% SameSKU + free 5mg vial', () => {
    const items = [vial('A',100,5), vial('B',150,1), vial('C',200,1), vial('D',250,1)];
    const t = computeCartTotals(items);
    expect(t.subtotal_cents).toBe(50000 + 15000 + 20000 + 25000); // 110000
    expect(t.stack_save_tier_percent).toBe(25);
    expect(t.same_sku_discount_cents).toBeGreaterThan(0);
    expect(t.free_vial_entitlement).toEqual({ size_mg: 5 });
  });

  it('U-COMBO-3: rounding consistency — sum of per-line allocated discounts equals reported totals', () => {
    const t = computeCartTotals([vial('A',99,3)]);
    // Three $99 vials = $297 subtotal → 15% Stack&Save → $44.55 in cents = 4455
    // Cents math must be deterministic and not lose money.
    const expectedStack = Math.round(29700 * 0.15); // 4455
    expect(t.stack_save_discount_cents).toBe(expectedStack);
  });
});

describe('computeCartTotalsForCheckout', () => {
  it('U-COMBO-SUB-1: subscriptionMode=null → identical shape to computeCartTotals', () => {
    const items = [vial('A', 100, 3)];
    const base = computeCartTotals(items);
    const checkout = computeCartTotalsForCheckout(items, null);
    expect(checkout.subtotal_cents).toBe(base.subtotal_cents);
    expect(checkout.stack_save_tier_percent).toBe(base.stack_save_tier_percent);
    expect(checkout.stack_save_discount_cents).toBe(base.stack_save_discount_cents);
    expect(checkout.same_sku_discount_cents).toBe(base.same_sku_discount_cents);
    expect(checkout.total_cents).toBe(base.total_cents);
    expect(checkout.subscription_discount_percent).toBe(0);
    expect(checkout.subscription_discount_cents).toBe(0);
  });

  it('U-COMBO-SUB-2: prepay 6mo monthly → Stack&Save replaced with 25% subscription discount', () => {
    const items = [vial('A', 100, 3)]; // 3 vials → would normally be 15% Stack&Save
    const checkout = computeCartTotalsForCheckout(items, {
      duration_months: 6,
      payment_cadence: 'prepay',
      ship_cadence: 'monthly',
    });
    expect(checkout.subtotal_cents).toBe(30000);
    expect(checkout.stack_save_tier_percent).toBe(0); // overridden
    expect(checkout.stack_save_discount_cents).toBe(0);
    expect(checkout.subscription_discount_percent).toBe(25);
    expect(checkout.subscription_discount_cents).toBe(7500); // 25% of 30000
    expect(checkout.total_cents).toBe(30000 - 7500);
  });

  it('U-COMBO-SUB-3: prepay 12mo + ship_once → 38% subscription discount, smaller total than monthly', () => {
    const items = [vial('A', 100, 3)];
    const monthly = computeCartTotalsForCheckout(items, {
      duration_months: 12,
      payment_cadence: 'prepay',
      ship_cadence: 'monthly',
    });
    const once = computeCartTotalsForCheckout(items, {
      duration_months: 12,
      payment_cadence: 'prepay',
      ship_cadence: 'once',
    });
    expect(monthly.subscription_discount_percent).toBe(35);
    expect(once.subscription_discount_percent).toBe(38);
    expect(once.total_cents).toBeLessThan(monthly.total_cents);
  });

  it('U-COMBO-SUB-4: same-SKU multiplier 5+ AND subscription mode → both apply', () => {
    const items = [vial('A', 100, 5)]; // 5 vials of same SKU
    const checkout = computeCartTotalsForCheckout(items, {
      duration_months: 6,
      payment_cadence: 'prepay',
      ship_cadence: 'monthly',
    });
    expect(checkout.subtotal_cents).toBe(50000);
    expect(checkout.stack_save_tier_percent).toBe(0); // replaced
    expect(checkout.subscription_discount_percent).toBe(25);
    expect(checkout.subscription_discount_cents).toBe(12500); // 25% of 50000
    expect(checkout.same_sku_multiplier_percent).toBe(5);
    // Same-SKU stacks on top of subscription discount, applied to post-subscription total
    expect(checkout.same_sku_discount_cents).toBe(Math.round((50000 - 12500) * 0.05));
    expect(checkout.total_cents).toBe(50000 - 12500 - checkout.same_sku_discount_cents);
  });
});
