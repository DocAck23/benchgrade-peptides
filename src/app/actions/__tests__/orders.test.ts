import { describe, it, expect, vi, beforeEach } from "vitest";
import { computeCartTotals } from "@/lib/cart/discounts";
import type { CartItem } from "@/lib/cart/types";

// ---------------------------------------------------------------------------
// Module mocks. submitOrder pulls in next/headers, the supabase server
// client, rate-limit storage, and resend. We stub each at the module
// boundary so the action runs in pure userland and we can capture the
// row that would have been inserted into Postgres.
// ---------------------------------------------------------------------------

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-forwarded-for": "127.0.0.1",
      "user-agent": "vitest",
    }),
}));

// In-memory capture for orders.insert(row).
const insertedRows: Record<string, unknown[]> = {};

function makeStubSupabase() {
  return {
    from(table: string) {
      return {
        insert(row: unknown) {
          insertedRows[table] = insertedRows[table] ?? [];
          insertedRows[table].push(row);
          return Promise.resolve({ error: null });
        },
        delete() {
          return {
            eq: () => Promise.resolve({ error: null }),
          };
        },
      };
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => makeStubSupabase(),
}));

// Bypass rate limiting and IP gating — they're tested elsewhere.
vi.mock("@/lib/ratelimit/enforce", () => ({
  enforceOrderRateLimit: async () => ({ allowed: true }),
  ORDER_RATE_LIMIT: { limit: 5, windowSeconds: 3600 },
}));

vi.mock("@/lib/ratelimit/supabase-store", () => ({
  SupabaseRateLimitStore: class {},
  RateLimitStoreError: class extends Error {},
}));

vi.mock("@/lib/payments/methods", async () => {
  const actual = await vi.importActual<typeof import("@/lib/payments/methods")>(
    "@/lib/payments/methods"
  );
  return {
    ...actual,
    enabledPaymentMethods: () => ["wire", "ach", "zelle", "crypto"],
  };
});

vi.mock("@/lib/email/client", () => ({
  getResend: () => null,
  EMAIL_FROM: "test <test@test>",
  ADMIN_NOTIFICATION_EMAIL: "admin@test",
}));

// Pull in submitOrder AFTER mocks are registered so the module-level
// imports resolve to the stubs above.
import { submitOrder } from "../orders";

const VALID_CUSTOMER = {
  name: "Test Researcher",
  email: "researcher@example.com",
  institution: "Test Lab",
  phone: "555-0100",
  ship_address_1: "1 Bench Way",
  ship_city: "Cambridge",
  ship_state: "MA",
  ship_zip: "02139",
};

const VALID_ACK = {
  is_adult: true as const,
  is_researcher: true as const,
  accepts_ruo: true as const,
};

beforeEach(() => {
  for (const k of Object.keys(insertedRows)) delete insertedRows[k];
});

describe("submitOrder — server-side discount computation", () => {
  it("I-SUBMIT-1: persists server-computed total_cents from computeCartTotals", async () => {
    // BGP-GLP1S-5 retail $110 × 3 vials. computeCartTotals applies the
    // 15% Stack&Save tier (3 vials) and 0% Same-SKU multiplier (need ≥5
    // of one SKU to trigger). Whatever the engine outputs, the row
    // MUST match it — we don't hardcode the expected value here.
    const items = [{ sku: "BGP-GLP1S-5", quantity: 3 }];

    // Replay the engine to know what the expected output is.
    const engineItems: CartItem[] = [
      {
        sku: "BGP-GLP1S-5",
        product_slug: "glp-1-s",
        category_slug: "x",
        name: "x",
        size_mg: 5,
        pack_size: 1,
        unit_price: 110,
        quantity: 3,
        vial_image: "",
      },
    ];
    const engine = computeCartTotals(engineItems);

    const result = await submitOrder({
      customer: VALID_CUSTOMER,
      items,
      acknowledgment: VALID_ACK,
      payment_method: "wire",
    });

    if (!result.ok) throw new Error(`submitOrder failed: ${result.error}`);
    expect(result.ok).toBe(true);
    const orderRow = insertedRows["orders"]?.[0] as Record<string, unknown>;
    expect(orderRow).toBeDefined();
    expect(orderRow.subtotal_cents).toBe(engine.subtotal_cents);
    expect(orderRow.discount_cents).toBe(
      engine.subtotal_cents - engine.total_cents
    );
    expect(orderRow.total_cents).toBe(engine.total_cents);
    expect(orderRow.free_vial_entitlement).toEqual(engine.free_vial_entitlement);
  });

  it("forged-input: client-supplied discount_cents is ignored; server total wins", async () => {
    const items = [{ sku: "BGP-GLP1S-5", quantity: 3 }];
    const engineItems: CartItem[] = [
      {
        sku: "BGP-GLP1S-5",
        product_slug: "glp-1-s",
        category_slug: "x",
        name: "x",
        size_mg: 5,
        pack_size: 1,
        unit_price: 110,
        quantity: 3,
        vial_image: "",
      },
    ];
    const engine = computeCartTotals(engineItems);

    // Hostile payload — extra fields that Zod should schema-strip.
    const forged = {
      customer: VALID_CUSTOMER,
      items,
      acknowledgment: VALID_ACK,
      payment_method: "wire" as const,
      // Forged fields:
      discount_cents: 99999,
      total_cents: 1,
      free_vial_entitlement: { size_mg: 10 as const },
    };

    const result = await submitOrder(forged as Parameters<typeof submitOrder>[0]);
    expect(result.ok).toBe(true);
    const orderRow = insertedRows["orders"]?.[0] as Record<string, unknown>;
    expect(orderRow).toBeDefined();
    // The row uses the engine output, not the forged values.
    expect(orderRow.discount_cents).toBe(
      engine.subtotal_cents - engine.total_cents
    );
    expect(orderRow.discount_cents).not.toBe(99999);
    expect(orderRow.total_cents).toBe(engine.total_cents);
    expect(orderRow.total_cents).not.toBe(1);
    expect(orderRow.free_vial_entitlement).toEqual(engine.free_vial_entitlement);
  });

  it.todo("I-SUBMIT-2: account-claim email sent after Sprint 1 Task 9");
  it.todo("I-SUBMIT-3: magic-link account-claim flow — Sprint 1 Task 9");
});
