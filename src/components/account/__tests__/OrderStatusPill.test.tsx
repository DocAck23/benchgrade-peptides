// Pure-render snapshot tests for <OrderStatusPill>. We follow the project's
// no-RTL pattern (see src/components/brand/__tests__/Logo.test.tsx) — invoke
// the component as a function and inspect the returned ReactElement directly.
// Vitest accepts .tsx files via its include glob.
import { describe, it, expect } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { OrderStatusPill } from "../OrderStatusPill";

type AnyEl = ReactElement<Record<string, unknown>>;

function isElement(node: ReactNode): node is AnyEl {
  return typeof node === "object" && node !== null && "props" in (node as object);
}

function textOf(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isElement(node)) {
    const children = (node.props as { children?: ReactNode }).children;
    return textOf(children);
  }
  return "";
}

describe("<OrderStatusPill>", () => {
  it("S-PILL-1: awaiting_payment renders the awaiting copy + paper-soft variant", () => {
    const tree = OrderStatusPill({ status: "awaiting_payment" });
    expect(textOf(tree)).toBe("Awaiting payment");
    const cls = String((tree as AnyEl).props.className);
    expect(cls).toContain("bg-paper-soft");
    expect(cls).toContain("text-ink-soft");
    expect(cls).toContain("border-gold-dark");
    expect((tree as AnyEl).props["data-status"]).toBe("awaiting_payment");
  });

  it("S-PILL-2: awaiting_wire (legacy) renders the same Awaiting copy", () => {
    const tree = OrderStatusPill({ status: "awaiting_wire" });
    expect(textOf(tree)).toBe("Awaiting payment");
    expect((tree as AnyEl).props["data-status"]).toBe("awaiting_wire");
  });

  it("S-PILL-3: funded renders 'Payment received' with gold variant", () => {
    const tree = OrderStatusPill({ status: "funded" });
    expect(textOf(tree)).toBe("Payment received");
    const cls = String((tree as AnyEl).props.className);
    expect(cls).toContain("bg-gold");
    expect(cls).toContain("text-ink");
  });

  it("S-PILL-4: shipped renders 'Shipped' with wine variant", () => {
    const tree = OrderStatusPill({ status: "shipped" });
    expect(textOf(tree)).toBe("Shipped");
    const cls = String((tree as AnyEl).props.className);
    expect(cls).toContain("bg-wine");
    expect(cls).toContain("text-paper");
  });

  it("S-PILL-5: cancelled renders muted variant", () => {
    const tree = OrderStatusPill({ status: "cancelled" });
    expect(textOf(tree)).toBe("Cancelled");
    const cls = String((tree as AnyEl).props.className);
    expect(cls).toContain("bg-paper");
    expect(cls).toContain("text-ink-muted");
    expect(cls).toContain("border-gold-dark");
  });

  it("S-PILL-6: refunded renders muted variant", () => {
    const tree = OrderStatusPill({ status: "refunded" });
    expect(textOf(tree)).toBe("Refunded");
    const cls = String((tree as AnyEl).props.className);
    expect(cls).toContain("bg-paper");
    expect(cls).toContain("text-ink-muted");
  });

  it("S-PILL-7: typography lock — Inter, 11px, uppercase, tracked 0.08em", () => {
    const tree = OrderStatusPill({ status: "funded" });
    const cls = String((tree as AnyEl).props.className);
    expect(cls).toContain("text-[11px]");
    expect(cls).toContain("tracking-[0.08em]");
    expect(cls).toContain("uppercase");
    expect(cls).toContain("rounded-sm");
  });
});
