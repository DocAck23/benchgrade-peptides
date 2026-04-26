// Pure-render tests for <SubscriptionUpsellCard/> (Wave B2). Vitest runs in
// `node` env, so we mock useCart and treat the component as a function call,
// walking the returned ReactElement tree to assert on copy/structure/aria.
// Mirrors the pattern used in src/components/cart/__tests__/CartDrawer.test.tsx.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement, ReactNode } from "react";
import type { CartItem } from "@/lib/cart/types";
import type { SubscriptionModeForCart, CheckoutCartTotals } from "@/lib/cart/discounts";
import {
  computeCartTotals,
  computeCartTotalsForCheckout,
} from "@/lib/cart/discounts";

type AnyEl = ReactElement<Record<string, unknown>>;

function isElement(node: ReactNode): node is AnyEl {
  return typeof node === "object" && node !== null && "props" in (node as object);
}

function findAll(node: ReactNode, predicate: (el: AnyEl) => boolean): AnyEl[] {
  const hits: AnyEl[] = [];
  const walk = (n: ReactNode) => {
    if (!isElement(n)) return;
    if (predicate(n)) hits.push(n);
    const children = (n.props as { children?: ReactNode }).children;
    if (Array.isArray(children)) {
      for (const c of children) walk(c as ReactNode);
    } else if (children !== undefined) {
      walk(children as ReactNode);
    }
  };
  walk(node);
  return hits;
}

function textContent(node: ReactNode): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map((c) => textContent(c as ReactNode)).join(" ");
  if (isElement(node)) {
    const children = (node.props as { children?: ReactNode }).children;
    return textContent(children as ReactNode);
  }
  return "";
}

interface CartMock {
  items: CartItem[];
  subscriptionMode: SubscriptionModeForCart | null;
  setSubscriptionMode: (m: SubscriptionModeForCart | null) => void;
  totals: ReturnType<typeof computeCartTotals>;
  checkoutTotals: CheckoutCartTotals;
}

const cartMock: CartMock = {
  items: [],
  subscriptionMode: null,
  setSubscriptionMode: vi.fn(),
  totals: computeCartTotals([]),
  checkoutTotals: computeCartTotalsForCheckout([], null),
};

vi.mock("@/lib/cart/CartContext", () => ({
  useCart: () => cartMock,
}));

const { SubscriptionUpsellCard } = await import("../SubscriptionUpsellCard");

function vial(qty: number, packSize = 1, price = 100): CartItem {
  return {
    sku: `BGP-T-${qty}-${packSize}`,
    product_slug: "test",
    category_slug: "research-peptides",
    name: "Test Peptide",
    size_mg: 10,
    pack_size: packSize,
    unit_price: price,
    quantity: qty,
    vial_image: "/x.jpg",
  };
}

function setCart(
  items: CartItem[],
  mode: SubscriptionModeForCart | null = null,
  setter?: (m: SubscriptionModeForCart | null) => void,
) {
  cartMock.items = items;
  cartMock.subscriptionMode = mode;
  cartMock.totals = computeCartTotals(items);
  cartMock.checkoutTotals = computeCartTotalsForCheckout(items, mode);
  if (setter) cartMock.setSubscriptionMode = setter;
  else cartMock.setSubscriptionMode = vi.fn();
}

describe("<SubscriptionUpsellCard/> — C-CHECKOUT-SUB-1..4", () => {
  beforeEach(() => {
    setCart([]);
  });

  it("renders nothing when cart is empty", () => {
    setCart([]);
    const tree = SubscriptionUpsellCard();
    expect(tree).toBeNull();
  });

  it("C-CHECKOUT-SUB-1: prepay default selected, 5 duration buttons in radiogroup", () => {
    setCart([vial(1, 3)]);
    const tree = SubscriptionUpsellCard();
    const text = textContent(tree as ReactNode);
    expect(text).toMatch(/SUBSCRIBE & SAVE MORE/);

    // Find the duration radiogroup
    const groups = findAll(tree as ReactNode, (el) => {
      const role = (el.props as { role?: unknown }).role;
      return role === "radiogroup";
    });
    expect(groups.length).toBeGreaterThanOrEqual(1);

    // Find duration buttons by data attribute
    const durationButtons = findAll(tree as ReactNode, (el) => {
      const dt = (el.props as { "data-duration"?: unknown })["data-duration"];
      return typeof dt === "number";
    });
    expect(durationButtons.length).toBe(5); // 1, 3, 6, 9, 12 in prepay mode

    // Prepay should be selected by default
    const prepayToggle = findAll(tree as ReactNode, (el) => {
      const dc = (el.props as { "data-cadence"?: unknown })["data-cadence"];
      return dc === "prepay";
    });
    expect(prepayToggle.length).toBeGreaterThanOrEqual(1);
    expect((prepayToggle[0].props as { "aria-pressed"?: boolean })["aria-pressed"]).toBe(true);
  });

  it("C-CHECKOUT-SUB-2: bill-pay mode → 1mo button is disabled / N/A", () => {
    setCart([vial(1, 3)], {
      duration_months: 3,
      payment_cadence: "bill_pay",
      ship_cadence: "monthly",
    });
    const tree = SubscriptionUpsellCard();
    const oneMonthBtn = findAll(tree as ReactNode, (el) => {
      const dt = (el.props as { "data-duration"?: unknown })["data-duration"];
      return dt === 1;
    });
    expect(oneMonthBtn.length).toBe(1);
    expect((oneMonthBtn[0].props as { disabled?: boolean }).disabled).toBe(true);
  });

  it("C-CHECKOUT-SUB-3: prepay 6mo selected → live total preview shows $X today + savings", () => {
    // 3 packs × 1-vial × $100 = $300 subtotal
    setCart([vial(3, 1, 100)], {
      duration_months: 6,
      payment_cadence: "prepay",
      ship_cadence: "monthly",
    });
    const tree = SubscriptionUpsellCard();
    const text = textContent(tree as ReactNode);
    // $300 subtotal; 25% off = $75 savings; $225 today
    expect(text).toMatch(/\$225/);
    expect(text).toMatch(/\$75/);
    expect(text).toMatch(/save/i);
  });

  it("C-CHECKOUT-SUB-4: 'Subscribe to this stack' toggle OFF → setSubscriptionMode(null)", () => {
    const setter = vi.fn();
    setCart(
      [vial(1, 3)],
      { duration_months: 6, payment_cadence: "prepay", ship_cadence: "monthly" },
      setter,
    );
    const tree = SubscriptionUpsellCard();
    const subscribeToggle = findAll(tree as ReactNode, (el) => {
      const tid = (el.props as { "data-testid"?: unknown })["data-testid"];
      return tid === "subscribe-toggle";
    });
    expect(subscribeToggle.length).toBe(1);
    const onClick = (subscribeToggle[0].props as { onClick?: () => void }).onClick;
    expect(typeof onClick).toBe("function");
    onClick!();
    expect(setter).toHaveBeenCalledWith(null);
  });
});
