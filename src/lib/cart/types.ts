import type { CatalogProduct, CatalogVariant } from "@/lib/catalogue/data";

export interface CartItem {
  sku: string;
  product_slug: string;
  category_slug: string;
  name: string;
  /** Dose in mg (per vial). Mirrors product.dose_mg. */
  size_mg: number;
  /** Vials in this pack (1 / 5 / 10 for launch). */
  pack_size: number;
  /** Retail price for one whole pack (USD). */
  unit_price: number;
  /** Number of packs of this variant in the cart. */
  quantity: number;
  vial_image: string;
  /**
   * Bundle-supply line (BAC water, syringes, draw needles). First unit
   * is free; additional units charge `unit_price`. Excluded from the
   * vial-count for Stack & Save tiers and same-SKU multipliers.
   */
  is_supply?: boolean;
}

export interface CartState {
  items: CartItem[];
}

/**
 * Subscription mode tracked in the cart while shopping. Null = standard
 * one-shot order; non-null = the subscription upsell card has been opted
 * into. Wave C reads this in `submitOrder` to branch into the subscription
 * flow.
 */
export interface SubscriptionMode {
  duration_months: 3 | 6 | 12;
  payment_cadence: "prepay" | "bill_pay";
  ship_cadence: "monthly" | "quarterly" | "once";
}

export interface CartApi {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  /** Stack & Save totals — discounts applied, free-shipping flag, etc. Wave 2d. */
  totals: import("./discounts").CartTotals;
  /**
   * Checkout-aware totals. When `subscriptionMode` is null, equivalent to
   * `totals` (with subscription fields zeroed). When set, subscription
   * discount replaces Stack & Save and same-SKU stacks on top.
   */
  checkoutTotals: import("./discounts").CheckoutCartTotals;
  /** Next-tier nudge for the cart drawer / checkout summary; null at top tier. */
  nextTier: import("./discounts").NextTierInfo | null;
  /** Active subscription selection on the checkout upsell. Wave B2. */
  subscriptionMode: SubscriptionMode | null;
  /** Setter for the upsell card; pass null to clear. */
  setSubscriptionMode: (mode: SubscriptionMode | null) => void;
  addItem: (product: CatalogProduct, variant: CatalogVariant, quantity: number) => void;
  /**
   * Swap a cart line's variant in place. Used by the cart drawer's vial-size
   * selector. If the new SKU already exists in the cart as a different line,
   * the two lines merge (quantities sum); otherwise the existing line's
   * sku/name/size_mg/pack_size/unit_price/vial_image are rewritten.
   */
  changeItemVariant: (currentSku: string, product: CatalogProduct, newVariant: CatalogVariant) => void;
  updateQuantity: (sku: string, quantity: number) => void;
  removeItem: (sku: string) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  isDrawerOpen: boolean;
}
