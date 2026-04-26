// Pure-render snapshot tests for <SubscriptionStatusPill>.
// Mirrors OrderStatusPill.test.tsx pattern — invoke as a function.
import { describe, it, expect } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { SubscriptionStatusPill } from "../SubscriptionStatusPill";

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

describe("<SubscriptionStatusPill>", () => {
  it("S-SUBPILL-1: active → gold-dark on paper-soft, gold-dark border", () => {
    const tree = SubscriptionStatusPill({ status: "active" });
    expect(textOf(tree)).toBe("Active");
    const cls = String((tree as AnyEl).props.className);
    expect(cls).toContain("bg-paper-soft");
    expect(cls).toContain("text-gold-dark");
    expect(cls).toContain("border-gold-dark");
    expect((tree as AnyEl).props["data-status"]).toBe("active");
  });

  it("S-SUBPILL-2: paused → ink-soft on paper-soft, gold-dark border", () => {
    const tree = SubscriptionStatusPill({ status: "paused" });
    expect(textOf(tree)).toBe("Paused");
    const cls = String((tree as AnyEl).props.className);
    expect(cls).toContain("bg-paper-soft");
    expect(cls).toContain("text-ink-soft");
    expect(cls).toContain("border-gold-dark");
  });

  it("S-SUBPILL-3: cancelled → muted on paper", () => {
    const tree = SubscriptionStatusPill({ status: "cancelled" });
    expect(textOf(tree)).toBe("Cancelled");
    const cls = String((tree as AnyEl).props.className);
    expect(cls).toContain("bg-paper");
    expect(cls).toContain("text-ink-muted");
  });

  it("S-SUBPILL-4: completed → muted on paper", () => {
    const tree = SubscriptionStatusPill({ status: "completed" });
    expect(textOf(tree)).toBe("Completed");
    const cls = String((tree as AnyEl).props.className);
    expect(cls).toContain("bg-paper");
    expect(cls).toContain("text-ink-muted");
  });

  it("S-SUBPILL-5: typography lock — Inter, 11px, uppercase, tracked 0.08em", () => {
    const tree = SubscriptionStatusPill({ status: "active" });
    const cls = String((tree as AnyEl).props.className);
    expect(cls).toContain("text-[11px]");
    expect(cls).toContain("tracking-[0.08em]");
    expect(cls).toContain("uppercase");
    expect(cls).toContain("rounded-sm");
  });
});
