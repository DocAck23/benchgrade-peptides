// Pure-render tests for <CommissionLedgerTable>. No RTL — invoke as a
// function and walk the tree (matches SubscriptionCard test pattern).
import { describe, it, expect } from "vitest";
import type { ReactElement, ReactNode } from "react";
import type { CommissionLedgerRow } from "@/lib/supabase/types";
import { CommissionLedgerTable } from "../CommissionLedgerTable";

type AnyEl = ReactElement<Record<string, unknown>>;

function isElement(node: ReactNode): node is AnyEl {
  return typeof node === "object" && node !== null && "props" in (node as object);
}

function textOf(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isElement(node)) {
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

function row(over: Partial<CommissionLedgerRow> = {}): CommissionLedgerRow {
  return {
    id: "r1",
    affiliate_id: "aff",
    source_referral_id: null,
    source_order_id: "abcd1234ef",
    kind: "earned",
    amount_cents: 1000,
    tier_at_time: "bronze",
    created_at: "2026-04-25T10:00:00Z",
    ...over,
  };
}

describe("<CommissionLedgerTable>", () => {
  it("empty state — sales-surface copy", () => {
    const tree = CommissionLedgerTable({ entries: [] });
    expect(textOf(tree)).toMatch(/No commission yet — share your link to start earning\./);
  });

  it("renders earned with + sign and Earned label", () => {
    const tree = CommissionLedgerTable({
      entries: [row({ kind: "earned", amount_cents: 1500 })],
    });
    const text = textOf(tree);
    expect(text).toContain("Earned");
    expect(text).toContain("+$15.00");
  });

  it("renders all four kinds with the right labels and signs", () => {
    const tree = CommissionLedgerTable({
      entries: [
        row({ id: "a", kind: "earned", amount_cents: 1500 }),
        row({ id: "b", kind: "clawback", amount_cents: -500 }),
        row({ id: "c", kind: "redemption_debit", amount_cents: -1000 }),
        row({ id: "d", kind: "payout_debit", amount_cents: -2000 }),
      ],
    });
    const text = textOf(tree);
    expect(text).toContain("Earned");
    expect(text).toContain("Clawback");
    expect(text).toContain("Redeemed for vial credit");
    expect(text).toContain("Paid out");
    expect(text).toContain("+$15.00");
    expect(text).toContain("−$5.00");
    expect(text).toContain("−$10.00");
    expect(text).toContain("−$20.00");
  });

  it("renders dash when source_order_id is null", () => {
    const tree = CommissionLedgerTable({
      entries: [row({ kind: "clawback", source_order_id: null })],
    });
    expect(textOf(tree)).toContain("—");
  });
});
