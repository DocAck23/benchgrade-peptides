// Pure-render snapshot tests for <TierBadge>.
import { describe, it, expect } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { TierBadge } from "../TierBadge";

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

describe("<TierBadge>", () => {
  it("bronze → gold-dark on paper", () => {
    const tree = TierBadge({ tier: "bronze" });
    expect(textOf(tree)).toBe("Bronze");
    const cls = String((tree as AnyEl).props.className);
    expect(cls).toContain("text-gold-dark");
    expect(cls).toContain("bg-paper");
    expect((tree as AnyEl).props["data-tier"]).toBe("bronze");
  });

  it("silver → ink-soft on paper-soft, gold-dark border", () => {
    const tree = TierBadge({ tier: "silver" });
    expect(textOf(tree)).toBe("Silver");
    const cls = String((tree as AnyEl).props.className);
    expect(cls).toContain("text-ink-soft");
    expect(cls).toContain("bg-paper-soft");
    expect(cls).toContain("border-gold-dark");
  });

  it("gold → gold-dark on paper-soft", () => {
    const tree = TierBadge({ tier: "gold" });
    expect(textOf(tree)).toBe("Gold");
    const cls = String((tree as AnyEl).props.className);
    expect(cls).toContain("text-gold-dark");
    expect(cls).toContain("bg-paper-soft");
    expect(cls).toContain("border-gold-dark");
  });

  it("eminent → gold text on wine background (prestige)", () => {
    const tree = TierBadge({ tier: "eminent" });
    expect(textOf(tree)).toBe("Eminent");
    const cls = String((tree as AnyEl).props.className);
    expect(cls).toContain("bg-wine");
    expect(cls).toContain("text-gold");
  });

  it("typography lock — Cinzel (font-display), 12px, uppercase, tracked 0.14em, rounded-sm", () => {
    const tree = TierBadge({ tier: "bronze" });
    const cls = String((tree as AnyEl).props.className);
    expect(cls).toContain("font-display");
    expect(cls).toContain("text-[12px]");
    expect(cls).toContain("tracking-[0.14em]");
    expect(cls).toContain("uppercase");
    expect(cls).toContain("rounded-sm");
  });
});
