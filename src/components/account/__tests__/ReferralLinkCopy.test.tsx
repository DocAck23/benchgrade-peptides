// Pure-render tests for <ReferralLinkCopy> in vitest's node env. We mock
// useState so the component is invokable as a function, then walk the
// returned ReactElement tree.
import { describe, it, expect, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

type AnyEl = ReactElement<Record<string, unknown>>;

function isElement(node: ReactNode): node is AnyEl {
  return typeof node === "object" && node !== null && "props" in (node as object);
}
function findAll(node: ReactNode, p: (el: AnyEl) => boolean): AnyEl[] {
  const hits: AnyEl[] = [];
  const walk = (n: ReactNode) => {
    if (!isElement(n)) return;
    if (p(n)) hits.push(n);
    const c = (n.props as { children?: ReactNode }).children;
    if (Array.isArray(c)) c.forEach((x) => walk(x as ReactNode));
    else if (c !== undefined) walk(c as ReactNode);
  };
  walk(node);
  return hits;
}
function textOf(node: ReactNode): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map((c) => textOf(c as ReactNode)).join(" ");
  if (isElement(node)) {
    const c = (node.props as { children?: ReactNode }).children;
    return textOf(c as ReactNode);
  }
  return "";
}

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: vi.fn((initial: unknown) => [initial, vi.fn()]),
    useCallback: vi.fn((fn: unknown) => fn),
  };
});

import { ReferralLinkCopy } from "../ReferralLinkCopy";

describe("<ReferralLinkCopy>", () => {
  it("C-REF-1: renders a Copy link button labelled with the code", () => {
    const tree = ReferralLinkCopy({ code: "ABC1234", url: "https://benchgradepeptides.com/r/ABC1234" });
    const buttons = findAll(tree, (el) => el.type === "button");
    expect(buttons.length).toBe(1);
    const btn = buttons[0];
    expect(textOf(btn)).toContain("Copy link");
    expect((btn.props as Record<string, unknown>)["aria-label"]).toMatch(/ABC1234/);
  });
});
