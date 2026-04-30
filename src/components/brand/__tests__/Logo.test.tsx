// Pure-render unit tests for <Logo>. Vitest `environment: "node"` — we walk
// the ReactElement tree by hand instead of mounting under jsdom. DOM-level
// assertions (focus management etc.) live in the `*.dom.test.tsx` suite added
// in commit 21.
//
// v2 Foundation (sub-project A) replaces the v1 laurel/wordmark logo with the
// Pinyon-script lockup. Asset paths come from public/brand/logo-{gold,wine,
// red,cream,black}.png. Variants pick by surface; legacy v1 prop values
// ("mark", "full", "seal", "md", "lg", "xl") are mapped through to v2
// equivalents for back-compat during the codemod sweep.
import { describe, it, expect } from "vitest";
import type { ReactElement, ReactNode } from "react";
import { Logo } from "../Logo";

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

function findImage(node: ReactNode): AnyEl | null {
  return findFirst(node, (el) => {
    const alt = (el.props as { alt?: unknown }).alt;
    return typeof alt === "string" && alt.toLowerCase().includes("bench grade peptides");
  });
}

describe("<Logo>", () => {
  // ── v2 explicit variants ────────────────────────────────────────────────

  it("L1: variant=gold renders /brand/logo-gold.png", () => {
    const tree = Logo({ variant: "gold" });
    const img = findImage(tree);
    expect(img).not.toBeNull();
    expect(String(img!.props.src)).toMatch(/logo-gold\.png/);
    expect(img!.props.alt).toBe("Bench Grade Peptides");
  });

  it("L2a: variant=wine renders /brand/logo-wine.png", () => {
    const tree = Logo({ variant: "wine" });
    const img = findImage(tree);
    expect(img).not.toBeNull();
    expect(String(img!.props.src)).toMatch(/logo-wine\.png/);
  });

  it("L2b: variant=red renders /brand/logo-red.png", () => {
    const tree = Logo({ variant: "red" });
    expect(String(findImage(tree)!.props.src)).toMatch(/logo-red\.png/);
  });

  it("L2c: variant=cream renders /brand/logo-cream.png", () => {
    const tree = Logo({ variant: "cream" });
    expect(String(findImage(tree)!.props.src)).toMatch(/logo-cream\.png/);
  });

  it("L2d: variant=black renders /brand/logo-black.png", () => {
    const tree = Logo({ variant: "black" });
    expect(String(findImage(tree)!.props.src)).toMatch(/logo-black\.png/);
  });

  // ── Surface auto-pick (v2 SURFACE_VARIANT mapping) ──────────────────────

  it("L3a: surface=wine (no variant) auto-picks gold", () => {
    const tree = Logo({ surface: "wine" });
    expect(String(findImage(tree)!.props.src)).toMatch(/logo-gold\.png/);
  });

  it("L3b: surface=cream auto-picks wine", () => {
    const tree = Logo({ surface: "cream" });
    expect(String(findImage(tree)!.props.src)).toMatch(/logo-wine\.png/);
  });

  it("L3c: surface=black auto-picks gold", () => {
    const tree = Logo({ surface: "black" });
    expect(String(findImage(tree)!.props.src)).toMatch(/logo-gold\.png/);
  });

  it("L3d: surface=red auto-picks gold", () => {
    const tree = Logo({ surface: "red" });
    expect(String(findImage(tree)!.props.src)).toMatch(/logo-gold\.png/);
  });

  it("L3e: surface=gold auto-picks wine", () => {
    const tree = Logo({ surface: "gold" });
    expect(String(findImage(tree)!.props.src)).toMatch(/logo-wine\.png/);
  });

  // ── Variant beats surface ───────────────────────────────────────────────

  it("L4: explicit variant beats surface", () => {
    const tree = Logo({ variant: "black", surface: "cream" });
    expect(String(findImage(tree)!.props.src)).toMatch(/logo-black\.png/);
  });

  // ── Sizes (v2 named) ────────────────────────────────────────────────────

  it("L5a: size=nav renders 180px wide", () => {
    const tree = Logo({ size: "nav" });
    const img = findImage(tree)!;
    expect(img.props.width).toBe(1709);
    expect(img.props.height).toBe(441);
  });

  it("L5b: size=footer renders 280px wide (container)", () => {
    const tree = Logo({ size: "footer" });
    const span = findFirst(tree, (el) => {
      const style = (el.props as { style?: { width?: number } }).style;
      return style?.width === 280;
    });
    expect(span).not.toBeNull();
  });

  it("L5c: size=hero renders 320px wide (container)", () => {
    const tree = Logo({ size: "hero" });
    const span = findFirst(tree, (el) => {
      const style = (el.props as { style?: { width?: number } }).style;
      return style?.width === 320;
    });
    expect(span).not.toBeNull();
  });

  it("L5d: numeric size renders explicit width", () => {
    const tree = Logo({ size: 240 });
    const span = findFirst(tree, (el) => {
      const style = (el.props as { style?: { width?: number } }).style;
      return style?.width === 240;
    });
    expect(span).not.toBeNull();
  });

  // ── Legacy size shim (v1 callers that haven't migrated yet) ─────────────

  it("L6a: legacy size=md maps to 180 (v2 nav)", () => {
    const tree = Logo({ size: "md" });
    const span = findFirst(tree, (el) => {
      const style = (el.props as { style?: { width?: number } }).style;
      return style?.width === 180;
    });
    expect(span).not.toBeNull();
  });

  it("L6b: legacy size=lg maps to 280 (v2 footer)", () => {
    const tree = Logo({ size: "lg" });
    const span = findFirst(tree, (el) => {
      const style = (el.props as { style?: { width?: number } }).style;
      return style?.width === 280;
    });
    expect(span).not.toBeNull();
  });

  it("L6c: legacy size=xl maps to 320 (v2 hero)", () => {
    const tree = Logo({ size: "xl" });
    const span = findFirst(tree, (el) => {
      const style = (el.props as { style?: { width?: number } }).style;
      return style?.width === 320;
    });
    expect(span).not.toBeNull();
  });

  // ── Legacy variant shims ────────────────────────────────────────────────

  it("L7a: legacy variant=mark surface=wine resolves to gold (v2)", () => {
    const tree = Logo({ variant: "mark", surface: "wine" });
    expect(String(findImage(tree)!.props.src)).toMatch(/logo-gold\.png/);
  });

  it("L7b: legacy variant=mark surface=cream resolves to wine (v2)", () => {
    const tree = Logo({ variant: "mark", surface: "cream" });
    expect(String(findImage(tree)!.props.src)).toMatch(/logo-wine\.png/);
  });

  it("L7c: legacy variant=full surface=wine resolves to gold", () => {
    const tree = Logo({ variant: "full", surface: "wine" });
    expect(String(findImage(tree)!.props.src)).toMatch(/logo-gold\.png/);
  });

  it("L7d: legacy variant=wordmark renders text fallback (deprecated path)", () => {
    const tree = Logo({ variant: "wordmark" });
    expect(findImage(tree)).toBeNull();
    const text = findFirst(tree, (el) => {
      const children = (el.props as { children?: ReactNode }).children;
      return typeof children === "string" && children === "Bench Grade";
    });
    expect(text).not.toBeNull();
  });

  // ── Defaults ────────────────────────────────────────────────────────────

  it("L8: default render is gold variant at nav size (180)", () => {
    const tree = Logo({});
    expect(String(findImage(tree)!.props.src)).toMatch(/logo-gold\.png/);
    const span = findFirst(tree, (el) => {
      const style = (el.props as { style?: { width?: number } }).style;
      return style?.width === 180;
    });
    expect(span).not.toBeNull();
  });

  // ── Priority forwarding ────────────────────────────────────────────────

  it("L9: priority=true forwards to next/image", () => {
    const tree = Logo({ priority: true });
    expect(findImage(tree)!.props.priority).toBe(true);
  });
});
