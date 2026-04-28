import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CartItem } from "@/lib/cart/types";
import type { SubscriptionPlanInput } from "@/lib/subscriptions/discounts";

// ---------------------------------------------------------------------------
// Mocks. createSubscription writes via the service-role client; pause/resume/
// cancel + adminSwapSubscriptionItems read+write via either the cookie-scoped
// client (RLS) or the service-role client (admin). We stub each at the module
// boundary so the action runs in pure userland and we can inspect every call.
// ---------------------------------------------------------------------------

interface FakeUpdateBuilder {
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  __resolve: { data: unknown[] | null; error: { message: string } | null };
}

function makeUpdateBuilder(
  resolve: { data: unknown[] | null; error: { message: string } | null }
): FakeUpdateBuilder {
  const builder: Partial<FakeUpdateBuilder> = {};
  builder.__resolve = resolve;
  builder.eq = vi.fn(() => builder as FakeUpdateBuilder);
  builder.in = vi.fn(() => builder as FakeUpdateBuilder);
  builder.select = vi.fn(() =>
    Promise.resolve({ data: resolve.data, error: resolve.error })
  );
  return builder as FakeUpdateBuilder;
}

interface FakeFromBuilder {
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

const serviceFrom = vi.fn();
const cookieFrom = vi.fn();
const cookieGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => ({ from: serviceFrom }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createServerSupabase: async () => ({
    from: cookieFrom,
    auth: { getUser: cookieGetUser },
  }),
}));

const isAdminMock = vi.fn(async () => true);
vi.mock("@/lib/admin/auth", () => ({
  isAdmin: () => isAdminMock(),
}));

const sendSubscriptionStartedMock = vi.fn<(...args: unknown[]) => Promise<{ ok: boolean }>>();
vi.mock("@/lib/email/notifications/send-subscription-emails", () => ({
  sendSubscriptionStarted: (...args: unknown[]) => sendSubscriptionStartedMock(...args),
  sendSubscriptionCycleShipped: vi.fn(async () => ({ ok: true })),
  sendSubscriptionPaymentDue: vi.fn(async () => ({ ok: true })),
  sendSubscriptionRenewal: vi.fn(async () => ({ ok: true })),
}));

import {
  createSubscription,
  pauseSubscription,
  resumeSubscription,
  cancelSubscription,
} from "../subscriptions";
import { adminSwapSubscriptionItems, adminFireNextCycle } from "../admin";

const SAMPLE_ITEMS: CartItem[] = [
  {
    sku: "BPC-157-5MG",
    product_slug: "bpc-157",
    category_slug: "healing",
    name: "BPC-157",
    size_mg: 5,
    pack_size: 1,
    unit_price: 40,
    quantity: 2,
    vial_image: "/brand/vials/bpc-157-5mg.jpg",
  },
];

const SAMPLE_PLAN: SubscriptionPlanInput = {
  duration_months: 6,
  payment_cadence: "prepay",
  ship_cadence: "monthly",
};

const SUB_ID = "11111111-1111-1111-1111-111111111111";

const TEST_AUTH_USER_ID = "99999999-9999-4999-8999-999999999999";

beforeEach(() => {
  serviceFrom.mockReset();
  cookieFrom.mockReset();
  cookieGetUser.mockReset();
  cookieGetUser.mockResolvedValue({
    data: { user: { id: TEST_AUTH_USER_ID } },
    error: null,
  });
  sendSubscriptionStartedMock.mockReset();
  sendSubscriptionStartedMock.mockResolvedValue({ ok: true });
  isAdminMock.mockReset();
  isAdminMock.mockResolvedValue(true);
});

describe("createSubscription (I-SUB-1, I-SUB-2)", () => {
  it("I-SUB-1: happy path — inserts row, returns ok + subscription_id, fires email", async () => {
    const insertedRow = {
      id: SUB_ID,
      customer_user_id: null,
      plan_duration_months: 6,
      payment_cadence: "prepay",
      ship_cadence: "monthly",
      items: SAMPLE_ITEMS,
      cycle_subtotal_cents: 8000,
      cycle_total_cents: 6000,
      discount_percent: 25,
      status: "active",
      next_ship_date: new Date(Date.now() + 30 * 86400_000).toISOString(),
      next_charge_date: null,
      cycles_completed: 1,
      cycles_total: 6,
    };
    const insertBuilder = {
      select: vi.fn(() => ({
        single: vi.fn(async () => ({ data: insertedRow, error: null })),
      })),
    };
    serviceFrom.mockImplementation((table: string) => {
      if (table === "subscriptions") {
        return { insert: vi.fn(() => insertBuilder) };
      }
      throw new Error(`unexpected table ${table}`);
    });

    const res = await createSubscription({
      customer_user_id: null,
      customer_email: "researcher@example.com",
      items: SAMPLE_ITEMS,
      plan: SAMPLE_PLAN,
      first_order_id: "order-1",
    });

    expect(res.ok).toBe(true);
    expect(res.subscription_id).toBe(SUB_ID);
    expect(serviceFrom).toHaveBeenCalledWith("subscriptions");
    // Best-effort email fire
    expect(sendSubscriptionStartedMock).toHaveBeenCalled();
  });

  it("I-SUB-2: bill_pay + 1mo → invalid plan combination, no insert", async () => {
    const res = await createSubscription({
      customer_user_id: null,
      customer_email: "x@example.com",
      items: SAMPLE_ITEMS,
      plan: { duration_months: 1 as unknown as 3, payment_cadence: "bill_pay", ship_cadence: "monthly" },
      first_order_id: "order-1",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/invalid plan/i);
    expect(serviceFrom).not.toHaveBeenCalled();
    expect(sendSubscriptionStartedMock).not.toHaveBeenCalled();
  });
});

describe("pauseSubscription (I-SUB-3)", () => {
  it("active → paused succeeds via atomic in-status filter (service-role + ownership)", async () => {
    const builder = makeUpdateBuilder({
      data: [{ id: SUB_ID, status: "paused" }],
      error: null,
    });
    serviceFrom.mockImplementation((table: string) => {
      expect(table).toBe("subscriptions");
      return { update: vi.fn(() => builder) };
    });

    const res = await pauseSubscription(SUB_ID);
    expect(res.ok).toBe(true);
    // Codex review #3 H3: explicit ownership filter via auth.uid().
    expect(builder.eq).toHaveBeenCalledWith("id", SUB_ID);
    expect(builder.eq).toHaveBeenCalledWith(
      "customer_user_id",
      TEST_AUTH_USER_ID
    );
    expect(builder.in).toHaveBeenCalledWith("status", ["active"]);
  });

  it("paused → paused returns rowcount=0 error", async () => {
    const builder = makeUpdateBuilder({ data: [], error: null });
    serviceFrom.mockImplementation(() => ({ update: vi.fn(() => builder) }));
    const res = await pauseSubscription(SUB_ID);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/expected state/i);
  });

  it("unauthenticated caller → please-sign-in error, no DB", async () => {
    cookieGetUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    const res = await pauseSubscription(SUB_ID);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/sign in/i);
    expect(serviceFrom).not.toHaveBeenCalled();
  });
});

describe("resumeSubscription (I-SUB-4)", () => {
  it("paused → active recomputes next_ship_date from now (service-role + ownership)", async () => {
    let updatePayload: Record<string, unknown> | null = null;
    const builder = makeUpdateBuilder({
      data: [{ id: SUB_ID, status: "active", ship_cadence: "monthly" }],
      error: null,
    });
    serviceFrom.mockImplementation(() => ({
      // First we must SELECT the row (need ship_cadence to recompute next_ship_date).
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: { id: SUB_ID, ship_cadence: "monthly", status: "paused" },
              error: null,
            })),
          })),
        })),
      })),
      update: vi.fn((payload: Record<string, unknown>) => {
        updatePayload = payload;
        return builder;
      }),
    }));

    const before = Date.now();
    const res = await resumeSubscription(SUB_ID);
    expect(res.ok).toBe(true);
    expect(updatePayload).not.toBeNull();
    expect(updatePayload!.status).toBe("active");
    expect(updatePayload!.paused_at).toBeNull();
    // next_ship_date should be ~30 days from now (monthly cadence).
    const next = new Date(updatePayload!.next_ship_date as string).getTime();
    const expected = before + 30 * 86400_000;
    expect(Math.abs(next - expected)).toBeLessThan(60_000);
    expect(builder.in).toHaveBeenCalledWith("status", ["paused"]);
    expect(builder.eq).toHaveBeenCalledWith(
      "customer_user_id",
      TEST_AUTH_USER_ID
    );
  });
});

describe("cancelSubscription (I-SUB-5)", () => {
  it("active|paused → cancelled, cancelled_at set (service-role + ownership)", async () => {
    let updatePayload: Record<string, unknown> | null = null;
    const builder = makeUpdateBuilder({
      data: [{ id: SUB_ID, status: "cancelled" }],
      error: null,
    });
    serviceFrom.mockImplementation(() => ({
      update: vi.fn((payload: Record<string, unknown>) => {
        updatePayload = payload;
        return builder;
      }),
    }));
    const res = await cancelSubscription(SUB_ID);
    expect(res.ok).toBe(true);
    expect(updatePayload!.status).toBe("cancelled");
    expect(typeof updatePayload!.cancelled_at).toBe("string");
    expect(builder.in).toHaveBeenCalledWith("status", ["active", "paused"]);
    expect(builder.eq).toHaveBeenCalledWith(
      "customer_user_id",
      TEST_AUTH_USER_ID
    );
  });
});

describe("adminSwapSubscriptionItems (I-SUB-6)", () => {
  it("replaces items jsonb and recomputes totals from existing discount_percent", async () => {
    const newItems: CartItem[] = [
      {
        sku: "TB-500-5MG",
        product_slug: "tb-500",
        category_slug: "healing",
        name: "TB-500",
        size_mg: 5,
        pack_size: 1,
        unit_price: 50,
        quantity: 1,
        vial_image: "/brand/vials/tb-500-5mg.jpg",
      },
    ];
    let updatePayload: Record<string, unknown> | null = null;
    serviceFrom.mockImplementation((table: string) => {
      if (table !== "subscriptions") throw new Error(`unexpected ${table}`);
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(async () => ({
              data: { id: SUB_ID, discount_percent: 25, status: "active" },
              error: null,
            })),
          })),
        })),
        update: vi.fn((payload: Record<string, unknown>) => {
          updatePayload = payload;
          return {
            eq: vi.fn(async () => ({ data: [{ id: SUB_ID }], error: null })),
          };
        }),
      };
    });

    const res = await adminSwapSubscriptionItems(SUB_ID, newItems);
    expect(res.ok).toBe(true);
    expect(updatePayload!.items).toEqual(newItems);
    // 1 * $50 = 5000 cents subtotal; 25% off → 3750 total.
    expect(updatePayload!.cycle_subtotal_cents).toBe(5000);
    expect(updatePayload!.cycle_total_cents).toBe(3750);
  });

  it("non-admin caller refused", async () => {
    isAdminMock.mockResolvedValueOnce(false);
    const res = await adminSwapSubscriptionItems(SUB_ID, SAMPLE_ITEMS);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/unauthorized/i);
    expect(serviceFrom).not.toHaveBeenCalled();
  });
});

describe("adminFireNextCycle smoke", () => {
  it("non-admin refused", async () => {
    isAdminMock.mockResolvedValueOnce(false);
    const res = await adminFireNextCycle(SUB_ID);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/unauthorized/i);
  });
});
