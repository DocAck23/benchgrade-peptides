// Pure-render tests for the Stack & Save UI surfaces (Wave 2d). The repo's
// vitest config runs in `node` (no DOM, no Testing Library), so we mock
// `useCart` and call `StackSaveProgress` as a function, walking the returned
// ReactElement tree to assert on copy/structure. This mirrors the pattern in
// `src/components/brand/__tests__/Logo.test.tsx`.
//
// We cover the C-CART-1..4 cases from the Sprint 1 plan §A.3 against the
// Stack & Save progress component (the surface that actually computes the
// nudge copy and tier badge). CartDrawer integration is exercised
// transitively via the same `useCart()` shape; full DOM-level focus / tab
// behavior remains covered by the existing CartDrawer browser smoke tests.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement, ReactNode } from "react";
import type { CartTotals, NextTierInfo } from "@/lib/cart/discounts";
import {
  computeCartTotals,
  nextStackSaveTier,
} from "@/lib/cart/discounts";
import type { CartItem } from "@/lib/cart/types";

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

// ---- mock useCart so StackSaveProgress can be invoked as a pure function ----
const cartMock: { totals: CartTotals; nextTier: NextTierInfo | null } = {
  totals: computeCartTotals([]),
  nextTier: null,
};

vi.mock("@/lib/cart/CartContext", () => ({
  useCart: () => cartMock,
}));

// Import AFTER vi.mock so the mock applies.
const { StackSaveProgress } = await import("../StackSaveProgress");

function setCart(items: CartItem[]) {
  const totals = computeCartTotals(items);
  cartMock.totals = totals;
  cartMock.nextTier = nextStackSaveTier(totals.vial_count);
}

function singleItem(qty: number, packSize: number = 1): CartItem {
  return {
    sku: "BGP-TEST-10-1",
    product_slug: "test",
    category_slug: "research-peptides",
    name: "Test Peptide",
    size_mg: 10,
    pack_size: packSize,
    unit_price: 100,
    quantity: qty,
    vial_image: "/x.jpg",
  };
}

describe("<StackSaveProgress> — C-CART-1..4", () => {
  beforeEach(() => {
    setCart([]);
  });

  it("C-CART-1: at 1 vial, shows free-shipping nudge with progress bar at ~50%", () => {
    setCart([singleItem(1, 1)]);
    const tree = StackSaveProgress();
    expect(tree).not.toBeNull();
    const text = textContent(tree as ReactNode);
    expect(text).toMatch(/Add 1 more vial.*free domestic shipping/);
    const bar = findAll(tree as ReactNode, (el) => {
      const role = (el.props as { role?: unknown }).role;
      return role === "progressbar";
    });
    expect(bar.length).toBe(1);
    expect((bar[0].props as { "aria-valuenow"?: number })["aria-valuenow"]).toBe(50);
  });

  it("C-CART-2: at 3 vials (15% tier), eyebrow shows '15% off unlocked'", () => {
    setCart([singleItem(1, 3)]);
    const tree = StackSaveProgress();
    const text = textContent(tree as ReactNode);
    expect(text).toMatch(/15% off unlocked/);
    // 3 vials → next tier is 5 (20% off), progress = round(3/5*100) = 60
    const bar = findAll(tree as ReactNode, (el) => {
      const role = (el.props as { role?: unknown }).role;
      return role === "progressbar";
    });
    expect((bar[0].props as { "aria-valuenow"?: number })["aria-valuenow"]).toBe(60);
    expect(text).toMatch(/Add 2 more vials.*20% off/);
  });

  it("C-CART-3: tier-transition (2 → 3 vials) updates active eyebrow + nudge text", () => {
    setCart([singleItem(1, 2)]);
    const tree2 = StackSaveProgress();
    const text2 = textContent(tree2 as ReactNode);
    expect(text2).toMatch(/Free shipping unlocked/);
    expect(text2).toMatch(/15% off the order/);

    setCart([singleItem(1, 3)]);
    const tree3 = StackSaveProgress();
    const text3 = textContent(tree3 as ReactNode);
    expect(text3).toMatch(/15% off unlocked/);
    expect(text3).not.toMatch(/Free shipping unlocked/);
  });

  it("C-CART-4: at 8 vials (25% tier), shows 'free 5mg vial' entitlement copy", () => {
    setCart([singleItem(1, 8)]);
    const tree = StackSaveProgress();
    const text = textContent(tree as ReactNode);
    expect(text).toMatch(/25% off \+ free 5mg vial unlocked/);
    // Next tier is 12 (28% + free 10mg vial)
    expect(text).toMatch(/Add 4 more vials.*free 10mg vial/);
  });

  it("returns null when the cart is empty", () => {
    setCart([]);
    const tree = StackSaveProgress();
    expect(tree).toBeNull();
  });

  it("at the top tier (>=12 vials), shows celebratory message and no progress bar", () => {
    setCart([singleItem(1, 12)]);
    const tree = StackSaveProgress();
    const text = textContent(tree as ReactNode);
    expect(text).toMatch(/All tiers unlocked/);
    const bar = findAll(tree as ReactNode, (el) => {
      const role = (el.props as { role?: unknown }).role;
      return role === "progressbar";
    });
    expect(bar.length).toBe(0);
  });
});
