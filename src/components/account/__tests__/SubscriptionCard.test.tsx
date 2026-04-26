// Pure-render snapshot tests for <SubscriptionCard>. Mirrors the no-RTL
// pattern — invoke as a function and walk the returned ReactElement tree.
import { describe, it, expect } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { SubscriptionCard } from "../SubscriptionCard";
import type { SubscriptionRow } from "@/lib/supabase/types";

type AnyEl = ReactElement<Record<string, unknown>>;

function isElement(node: ReactNode): node is AnyEl {
  return typeof node === "object" && node !== null && "props" in (node as object);
}

function textOf(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isElement(node)) {
    // Recurse into nested function components so child component text
    // (e.g. <SubscriptionStatusPill>) shows up in our flat string.
    if (typeof node.type === "function") {
      const fn = node.type as (p: Record<string, unknown>) => ReactNode;
      try {
        return textOf(fn(node.props));
      } catch {
        return "";
      }
    }
    const children = (node.props as { children?: ReactNode }).children;
    return textOf(children);
  }
  return "";
}

function baseSub(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    customer_user_id: "user-abc",
    plan_duration_months: 3,
    payment_cadence: "bill_pay",
    ship_cadence: "monthly",
    items: [
      {
        sku: "SKU-A",
        product_slug: "alpha",
        category_slug: "research",
        name: "Alpha Peptide",
        size_mg: 5,
        unit_price: 49.0,
        quantity: 1,
        vial_image: "/images/vial-a.png",
      },
      {
        sku: "SKU-B",
        product_slug: "beta",
        category_slug: "research",
        name: "Beta Peptide",
        size_mg: 10,
        unit_price: 79.0,
        quantity: 2,
        vial_image: "/images/vial-b.png",
      },
    ],
    cycle_subtotal_cents: 20700,
    cycle_total_cents: 18630,
    discount_percent: 10,
    status: "active",
    next_ship_date: "2026-05-15T00:00:00.000Z",
    next_charge_date: "2026-05-15T00:00:00.000Z",
    cycles_completed: 1,
    cycles_total: 3,
    created_at: "2026-04-15T00:00:00.000Z",
    updated_at: "2026-04-15T00:00:00.000Z",
    paused_at: null,
    cancelled_at: null,
    ...overrides,
  };
}

describe("<SubscriptionCard>", () => {
  it("S-SUBCARD-1: active sub renders eyebrow, plan line, next-ship, cycle counter, prices", () => {
    const tree = SubscriptionCard({ sub: baseSub() });
    const text = textOf(tree);
    expect(text).toContain("BGP-SUB-11111111");
    expect(text).toContain("3-month plan");
    expect(text).toContain("monthly bill-pay");
    expect(text).toContain("Next ship:");
    expect(text).toContain("Cycle 2 of 3");
    expect(text).toContain("$186.30/cycle");
    expect(text).toContain("$558.90 plan total");
    expect(text).toContain("Manage");
    expect(text).toContain("Active");
  });

  it("S-SUBCARD-2: prepay sub shows prepaid total label", () => {
    const tree = SubscriptionCard({
      sub: baseSub({ payment_cadence: "prepay" }),
    });
    const text = textOf(tree);
    expect(text).toContain("prepay");
    expect(text).toContain("$558.90 prepaid");
  });

  it("S-SUBCARD-3: paused sub hides next ship date", () => {
    const tree = SubscriptionCard({
      sub: baseSub({ status: "paused" }),
    });
    const text = textOf(tree);
    expect(text).toContain("Paused");
    expect(text).not.toContain("Next ship:");
  });

  it("S-SUBCARD-4: cancelled sub hides next ship date and shows pill", () => {
    const tree = SubscriptionCard({
      sub: baseSub({ status: "cancelled", next_ship_date: null }),
    });
    const text = textOf(tree);
    expect(text).toContain("Cancelled");
    expect(text).not.toContain("Next ship:");
  });

  it("S-SUBCARD-5: cycle counter caps at cycles_total", () => {
    const tree = SubscriptionCard({
      sub: baseSub({ cycles_completed: 3, cycles_total: 3, status: "completed" }),
    });
    expect(textOf(tree)).toContain("Cycle 3 of 3");
  });
});
