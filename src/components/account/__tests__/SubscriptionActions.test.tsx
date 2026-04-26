// Tests for <SubscriptionActions> (client component). The repo runs vitest
// in the `node` environment with no Testing Library, so we mock React's
// state hooks + next/navigation + the server-action module, then invoke
// the component as a pure function and walk the returned ReactElement tree.
//
// We cover C-PORTAL-SUB rendering shape per status (active / paused /
// cancelled / completed) plus the two-step cancel confirm panel.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement, ReactNode } from "react";
import type { SubscriptionRow } from "@/lib/supabase/types";

type AnyEl = ReactElement<Record<string, unknown>>;

function isElement(node: ReactNode): node is AnyEl {
  return typeof node === "object" && node !== null && "props" in (node as object);
}

function findAll(node: ReactNode, predicate: (el: AnyEl) => boolean): AnyEl[] {
  const hits: AnyEl[] = [];
  const walk = (n: ReactNode) => {
    if (!isElement(n)) return;
    if (predicate(n)) hits.push(n);
    const children = (n.props as { children?: ReactNode }).children;
    if (Array.isArray(children)) for (const c of children) walk(c as ReactNode);
    else if (children !== undefined) walk(children as ReactNode);
  };
  walk(node);
  return hits;
}

function textOf(node: ReactNode): string {
  if (node == null || node === false) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map((c) => textOf(c as ReactNode)).join(" ");
  if (isElement(node)) {
    const children = (node.props as { children?: ReactNode }).children;
    return textOf(children as ReactNode);
  }
  return "";
}

// ---- Hook mocks: useState/useTransition are stubbed so the function-call
// invocation pattern works in the node env without a React renderer. ----
let confirmingCancel = false;
const setConfirmingCancel = vi.fn((v: boolean | ((prev: boolean) => boolean)) => {
  confirmingCancel = typeof v === "function" ? (v as (p: boolean) => boolean)(confirmingCancel) : v;
});

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useState: vi.fn((initial: unknown) => {
      // First call: pending (null). Second: confirmingCancel. Third: error (null).
      const seq = (globalThis as unknown as { __seq: number }).__seq ?? 0;
      (globalThis as unknown as { __seq: number }).__seq = seq + 1;
      if (seq % 3 === 1) return [confirmingCancel, setConfirmingCancel];
      return [initial, vi.fn()];
    }),
    useTransition: vi.fn(() => [false, (cb: () => void) => cb()]),
  };
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/app/actions/subscriptions", () => ({
  pauseSubscription: vi.fn(async () => ({ ok: true })),
  resumeSubscription: vi.fn(async () => ({ ok: true })),
  cancelSubscription: vi.fn(async () => ({ ok: true })),
}));

import { SubscriptionActions } from "../SubscriptionActions";

function baseSub(overrides: Partial<SubscriptionRow> = {}): SubscriptionRow {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    customer_user_id: "user-abc",
    plan_duration_months: 6,
    payment_cadence: "prepay",
    ship_cadence: "monthly",
    items: [],
    cycle_subtotal_cents: 10000,
    cycle_total_cents: 8500,
    discount_percent: 15,
    status: "active",
    next_ship_date: "2026-05-01T00:00:00.000Z",
    next_charge_date: null,
    cycles_completed: 1,
    cycles_total: 6,
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
    paused_at: null,
    cancelled_at: null,
    ...overrides,
  };
}

beforeEach(() => {
  (globalThis as unknown as { __seq: number }).__seq = 0;
  confirmingCancel = false;
  setConfirmingCancel.mockClear();
});

describe("<SubscriptionActions>", () => {
  it("S-SUBACT-1: active sub renders Pause + Cancel buttons", () => {
    const tree = SubscriptionActions({ sub: baseSub({ status: "active" }) });
    const buttons = findAll(tree, (el) => el.type === "button");
    const labels = buttons.map((b) => textOf(b));
    expect(labels.some((l) => l.includes("Pause"))).toBe(true);
    expect(labels.some((l) => l.includes("Cancel subscription"))).toBe(true);
    expect(labels.some((l) => l.includes("Resume"))).toBe(false);
  });

  it("S-SUBACT-2: paused sub renders Resume + Cancel buttons", () => {
    (globalThis as unknown as { __seq: number }).__seq = 0;
    const tree = SubscriptionActions({ sub: baseSub({ status: "paused" }) });
    const buttons = findAll(tree, (el) => el.type === "button");
    const labels = buttons.map((b) => textOf(b));
    expect(labels.some((l) => l.includes("Resume"))).toBe(true);
    expect(labels.some((l) => l.includes("Cancel subscription"))).toBe(true);
    expect(labels.some((l) => l.includes("Pause"))).toBe(false);
  });

  it("S-SUBACT-3: cancelled sub renders Subscribe-again link, no action buttons", () => {
    (globalThis as unknown as { __seq: number }).__seq = 0;
    const tree = SubscriptionActions({ sub: baseSub({ status: "cancelled" }) });
    expect(textOf(tree)).toContain("Subscribe again");
    expect(textOf(tree)).toContain("cancelled");
  });

  it("S-SUBACT-4: completed sub renders 'Plan complete' copy", () => {
    (globalThis as unknown as { __seq: number }).__seq = 0;
    const tree = SubscriptionActions({ sub: baseSub({ status: "completed" }) });
    expect(textOf(tree)).toContain("Plan complete");
    expect(textOf(tree)).toContain("Subscribe again");
  });

  it("S-SUBACT-5: cancel confirm panel surfaces locked-in discount when expanded", () => {
    confirmingCancel = true;
    (globalThis as unknown as { __seq: number }).__seq = 0;
    const tree = SubscriptionActions({
      sub: baseSub({ status: "active", discount_percent: 22 }),
    });
    const text = textOf(tree);
    expect(text).toContain("Cancel this subscription?");
    expect(text).toMatch(/22\s*%\s*discount/);
    expect(text).toContain("Confirm cancel");
    expect(text).toContain("Keep subscription");
  });
});
