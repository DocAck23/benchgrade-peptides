// Pure-render tests for <TierProgressBar>.
import { describe, it, expect } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { TierProgressBar } from "../TierProgressBar";

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

function findFirst(
  node: ReactNode,
  predicate: (el: AnyEl) => boolean
): AnyEl | null {
  if (Array.isArray(node)) {
    for (const c of node) {
      const hit = findFirst(c, predicate);
      if (hit) return hit;
    }
    return null;
  }
  if (!isElement(node)) return null;
  if (predicate(node)) return node;
  if (typeof node.type === "function") {
    const fn = node.type as (p: Record<string, unknown>) => ReactNode;
    try {
      return findFirst(fn(node.props), predicate);
    } catch {
      return null;
    }
  }
  const children = (node.props as { children?: ReactNode }).children;
  return findFirst(children, predicate);
}

function findByAriaLabel(node: ReactNode, label: string): AnyEl | null {
  return findFirst(
    node,
    (el) => (el.props as Record<string, unknown>)["aria-label"] === label
  );
}

describe("<TierProgressBar>", () => {
  it("bronze → progress toward Silver, both rails present", () => {
    const tree = TierProgressBar({
      current: "bronze",
      totalRefs: 2,
      totalEarned: 20_000,
    });
    const text = textOf(tree);
    expect(text.toLowerCase()).toContain("silver");
    expect(text).toContain("2 / 5 refs");
    expect(text).toContain("$200.00 / $1,000.00 earned");

    const refsRail = findByAriaLabel(tree, "Referral progress to next tier");
    expect(refsRail).not.toBeNull();
    expect((refsRail!.props as Record<string, unknown>)["aria-valuenow"]).toBe(40);

    const earnRail = findByAriaLabel(tree, "Earnings progress to next tier");
    expect(earnRail).not.toBeNull();
    expect((earnRail!.props as Record<string, unknown>)["aria-valuenow"]).toBe(20);
  });

  it("silver → progress toward Gold (5/15 refs)", () => {
    const tree = TierProgressBar({
      current: "silver",
      totalRefs: 5,
      totalEarned: 100_000,
    });
    const text = textOf(tree);
    expect(text.toLowerCase()).toContain("gold");
    expect(text).toContain("5 / 15 refs");
  });

  it("gold → progress toward Eminent (20/50 refs)", () => {
    const tree = TierProgressBar({
      current: "gold",
      totalRefs: 20,
      totalEarned: 1_000_000,
    });
    const text = textOf(tree);
    expect(text.toLowerCase()).toContain("eminent");
    expect(text).toContain("20 / 50 refs");
  });

  it("eminent → celebratory state, no progress rails", () => {
    const tree = TierProgressBar({
      current: "eminent",
      totalRefs: 60,
      totalEarned: 3_000_000,
    });
    expect(textOf(tree)).toContain("Top tier reached.");
    const anyRail = findFirst(
      tree,
      (el) => (el.props as Record<string, unknown>).role === "progressbar"
    );
    expect(anyRail).toBeNull();
  });

  it("clamps progress at 100 when over the threshold", () => {
    const tree = TierProgressBar({
      current: "bronze",
      totalRefs: 99,
      totalEarned: 9_999_999,
    });
    const refsRail = findByAriaLabel(tree, "Referral progress to next tier");
    expect((refsRail!.props as Record<string, unknown>)["aria-valuenow"]).toBe(100);
  });
});
