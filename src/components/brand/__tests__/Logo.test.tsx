// Pure-render unit tests for <Logo>. We do NOT install React Testing Library
// or happy-dom here — instead we invoke the component as a function and walk
// the returned ReactElement tree to assert on rendered children/props. This
// keeps dev-deps lean and runs under vitest's `environment: "node"`.
//
// Vitest's default `include` is `src/**/__tests__/**/*.test.ts` (no .tsx). We
// match `*.test.tsx` here to keep React/JSX colocated; vitest.config.ts is
// updated to pick up `.tsx` test files in a follow-up if needed. For now,
// running `vitest run src/components/brand/__tests__/Logo.test.tsx` works
// because vitest accepts explicit file paths regardless of `include`.
import { describe, it, expect } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { Logo } from "../Logo";

type AnyEl = ReactElement<Record<string, unknown>>;

function isElement(node: ReactNode): node is AnyEl {
  return typeof node === "object" && node !== null && "props" in (node as object);
}

/**
 * Walk a ReactNode tree, returning the first element whose `type` (component
 * or tag string) matches the predicate.
 */
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

function findImage(node: ReactNode): AnyEl | null {
  // next/image renders as a function/object component; we match by alt prop.
  return findFirst(node, (el) => {
    const alt = (el.props as { alt?: unknown }).alt;
    return typeof alt === "string" && alt.toLowerCase().includes("bench grade peptides");
  });
}

describe("<Logo>", () => {
  it("S-LOGO-1: variant=full surface=wine renders the gold-on-transparent mark", () => {
    // Wine surface routes to the gold variant so the mark stands against
    // the wine background. Cream surface keeps the original wine fill.
    const tree = Logo({ variant: "full", surface: "wine" });
    const img = findImage(tree);
    expect(img).not.toBeNull();
    expect(String(img!.props.src)).toMatch(/logo-mark-gold\.svg/);
    expect(img!.props.alt).toBe("Bench Grade Peptides");
  });

  it("S-LOGO-2: variant=mark surface=cream uses logo-mark.svg directly", () => {
    const tree = Logo({ variant: "mark", surface: "cream" });
    const img = findImage(tree);
    expect(img).not.toBeNull();
    expect(String(img!.props.src)).toMatch(/logo-mark\.svg/);
  });

  it("S-LOGO-3: variant=mark surface=wine resolves to logo-mark-gold.svg", () => {
    // Wine surface gets the gold-on-transparent variant; the wine fill of
    // logo-mark.svg would disappear against the wine background.
    const tree = Logo({ variant: "mark", surface: "wine" });
    const img = findImage(tree);
    expect(img).not.toBeNull();
    expect(String(img!.props.src)).toMatch(/logo-mark-gold\.svg/);
  });

  it("S-LOGO-4: variant=wordmark renders Cinzel text, not an Image", () => {
    const tree = Logo({ variant: "wordmark", surface: "cream" });
    // No image when wordmark
    expect(findImage(tree)).toBeNull();
    // Text content should include "BENCH GRADE PEPTIDES"
    const textHolder = findFirst(tree, (el) => {
      const children = (el.props as { children?: ReactNode }).children;
      return typeof children === "string" && children.toUpperCase().includes("BENCH GRADE PEPTIDES");
    });
    expect(textHolder).not.toBeNull();
  });

  it("S-LOGO-5: defaults are variant=mark surface=cream", () => {
    const tree = Logo({});
    const img = findImage(tree);
    expect(img).not.toBeNull();
    expect(String(img!.props.src)).toMatch(/logo-mark\.svg/);
  });
});
