// Pure-render unit tests for <GoldBand>. Vitest node env — walks the
// returned ReactElement tree by hand. Layout/animation behavior is
// covered by the Playwright smoke spec added in sub-project follow-up.
import { describe, it, expect } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { GoldBand } from "../GoldBand";

type AnyEl = ReactElement<Record<string, unknown>>;

function isElement(node: ReactNode): node is AnyEl {
  return typeof node === "object" && node !== null && "props" in (node as object);
}

function findFirst(node: ReactNode, predicate: (el: AnyEl) => boolean): AnyEl | null {
  if (!isElement(node)) return null;
  if (predicate(node)) return node;
  const children = (node.props as { children?: ReactNode }).children;
  if (Array.isArray(children)) {
    for (const child of children) {
      const hit = findFirst(child as ReactNode, predicate);
      if (hit) return hit;
    }
  } else if (children !== undefined) {
    const hit = findFirst(children as ReactNode, predicate);
    if (hit) return hit;
  }
  return null;
}

function findAll(node: ReactNode, predicate: (el: AnyEl) => boolean): AnyEl[] {
  const out: AnyEl[] = [];
  function walk(n: ReactNode): void {
    if (!isElement(n)) return;
    if (predicate(n)) out.push(n);
    const children = (n.props as { children?: ReactNode }).children;
    if (Array.isArray(children)) for (const c of children) walk(c as ReactNode);
    else if (children !== undefined) walk(children as ReactNode);
  }
  walk(node);
  return out;
}

describe("<GoldBand>", () => {
  it("renders the headline", () => {
    const tree = GoldBand({ headline: "Every lot. Public receipts." });
    const h2 = findFirst(tree, (el) => el.type === "h2");
    expect(h2).not.toBeNull();
    const children = (h2!.props as { children?: ReactNode }).children;
    expect(children).toBe("Every lot. Public receipts.");
  });

  it("renders the eyebrow when provided", () => {
    const tree = GoldBand({
      eyebrow: "99.0% by HPLC",
      headline: "Every lot. Public receipts.",
    });
    const eyebrowDiv = findFirst(tree, (el) => {
      const cn = (el.props as { className?: string }).className;
      return typeof cn === "string" && cn.includes("uppercase") && cn.includes("tracking-");
    });
    expect(eyebrowDiv).not.toBeNull();
  });

  it("omits the eyebrow when not provided", () => {
    const tree = GoldBand({ headline: "Solo." });
    // No element with a 'uppercase' + 'tracking-[0.32em]' class set should exist
    const eyebrow = findFirst(tree, (el) => {
      const cn = (el.props as { className?: string }).className;
      return typeof cn === "string" && cn.includes("tracking-[0.32em]");
    });
    expect(eyebrow).toBeNull();
  });

  it("renders monogram dividers by default", () => {
    const tree = GoldBand({ headline: "Test" });
    const monograms = findAll(tree, (el) => {
      const alt = (el.props as { alt?: unknown }).alt;
      return alt === "" && (el.props as { src?: string }).src?.includes("bg-monogram") === true;
    });
    expect(monograms.length).toBeGreaterThanOrEqual(1);
  });

  it("hides monograms when withMonogramDividers=false", () => {
    const tree = GoldBand({ headline: "Test", withMonogramDividers: false });
    const monograms = findAll(tree, (el) => {
      const src = (el.props as { src?: string }).src;
      return typeof src === "string" && src.includes("bg-monogram");
    });
    expect(monograms.length).toBe(0);
  });

  it("section uses data-surface=gold + bg-gold class", () => {
    const tree = GoldBand({ headline: "Test" });
    const section = findFirst(tree, (el) => el.type === "section");
    expect(section).not.toBeNull();
    expect((section!.props as { "data-surface"?: string })["data-surface"]).toBe("gold");
    const cn = (section!.props as { className?: string }).className;
    expect(cn).toContain("bg-gold");
    expect(cn).toContain("text-wine");
  });

  it("includes a sr-only fallback announcing the brand", () => {
    const tree = GoldBand({ eyebrow: "Eyebrow", headline: "Headline" });
    const srOnly = findFirst(tree, (el) => {
      const cn = (el.props as { className?: string }).className;
      return typeof cn === "string" && cn.includes("sr-only");
    });
    expect(srOnly).not.toBeNull();
    const text = (srOnly!.props as { children?: ReactNode }).children;
    // Children may be an array of strings due to JSX interpolation
    const flat = Array.isArray(text) ? text.join("") : String(text ?? "");
    expect(flat).toContain("Eyebrow");
    expect(flat).toContain("Headline");
    expect(flat).toContain("Bench Grade");
  });
});
