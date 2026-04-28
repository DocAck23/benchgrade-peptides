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
  // submitOrder reads bgp_sess from cookies for session_id
  // attribution; the test path doesn't exercise it, so we stub a
  // get() that returns undefined.
  cookies: async () => ({
    get: () => undefined,
  }),
}));

// In-memory capture for orders.insert(row).
const insertedRows: Record<string, unknown[]> = {};

// Captures every generateLink({type,email,options}) call so I-SUBMIT-3
// can assert we called the Supabase admin API correctly. The result
// returned to submitOrder is configurable per test.
interface GenerateLinkArgs {
  type: string;
  email: string;
  options?: { redirectTo?: string };
}
const generateLinkCalls: GenerateLinkArgs[] = [];
let nextGenerateLinkResult: {
  data?: {
    properties?: {
      action_link?: string;
      hashed_token?: string;
    };
    user?: { id: string };
  };
  error?: unknown;
} = {
  data: {
    properties: {
      action_link: "https://stub-magic-link.test/abc",
      hashed_token: "stubhashedtoken",
    },
  },
};

// Captured supabase UPDATE calls keyed by table — used by I-CHECKOUT-SUB-1
// to assert the subscription_id back-link UPDATE on `orders`.
interface UpdateCall {
  table: string;
  values: Record<string, unknown>;
  eq: { column: string; value: unknown };
}
const updateCalls: UpdateCall[] = [];

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
        update(values: Record<string, unknown>) {
          return {
            eq: (column: string, value: unknown) => {
              updateCalls.push({ table, values, eq: { column, value } });
              return Promise.resolve({ error: null });
            },
          };
        },
      };
    },
    auth: {
      admin: {
        generateLink: async (args: GenerateLinkArgs) => {
          generateLinkCalls.push(args);
          return nextGenerateLinkResult;
        },
      },
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

// Captured Resend.emails.send() payloads — one entry per call. Tests
// that need to ignore Resend (the original I-SUBMIT-1 tests) clear the
// array in beforeEach; tests that need to assert (I-SUBMIT-2/3) inspect
// the captured calls. Returning a stub from getResend rather than null
// means the email-dispatch block in submitOrder runs end to end.
interface SentEmail {
  from: string;
  to: string;
  subject: string;
  text?: string;
  html?: string;
}
const sentEmails: SentEmail[] = [];
// Default OFF — the I-SUBMIT-1/forged tests don't care about email
// dispatch and predate the account-claim wiring. I-SUBMIT-2 and -3
// flip this on for their cases.
let resendShouldFire: boolean = false;

vi.mock("@/lib/email/client", () => ({
  getResend: () =>
    resendShouldFire
      ? {
          emails: {
            send: async (payload: SentEmail) => {
              sentEmails.push(payload);
              return { id: `stub-${sentEmails.length}` };
            },
          },
        }
      : null,
  EMAIL_FROM: "test <test@test>",
  ADMIN_NOTIFICATION_EMAIL: "admin@test",
}));

// createSubscription mock — Wave C1 wires submitOrder to call this when
// the customer toggled subscribe at checkout. The actual implementation
// lives in subscriptions.ts (Wave B1, out of scope here); we replace it
// with a vi.fn so tests can capture args and program the result.
interface CreateSubArgs {
  customer_user_id: string | null;
  customer_email: string;
  items: unknown[];
  plan: {
    duration_months: 1 | 3 | 6 | 9 | 12;
    payment_cadence: "prepay" | "bill_pay";
    ship_cadence: "monthly" | "quarterly" | "once";
  };
  first_order_id: string;
}
const createSubscriptionMock = vi.fn(
  async (
    _args: CreateSubArgs
  ): Promise<{ ok: boolean; subscription_id?: string; error?: string }> => ({
    ok: true,
    subscription_id: "stub-sub-id",
  })
);
vi.mock("@/app/actions/subscriptions", () => ({
  createSubscription: (args: CreateSubArgs) => createSubscriptionMock(args),
}));

// Pull in submitOrder AFTER mocks are registered so the module-level
// imports resolve to the stubs above.
import { submitOrder } from "../orders";

const VALID_CUSTOMER = {
  name: "Test Researcher",
  first_name: "Test",
  last_name: "Researcher",
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
  generateLinkCalls.length = 0;
  sentEmails.length = 0;
  updateCalls.length = 0;
  resendShouldFire = false;
  nextGenerateLinkResult = {
    data: { properties: { action_link: "https://stub-magic-link.test/abc" } },
  };
  createSubscriptionMock.mockClear();
  createSubscriptionMock.mockResolvedValue({
    ok: true,
    subscription_id: "stub-sub-id",
  });
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

  it("I-SUBMIT-2: account-claim email fires alongside customer + admin confirmation", async () => {
    resendShouldFire = true;
    nextGenerateLinkResult = {
      data: {
        properties: {
          action_link: "https://stub-magic-link.test/new-user",
          hashed_token: "stubclaimtoken123",
        },
      },
    };

    const result = await submitOrder({
      customer: VALID_CUSTOMER,
      items: [{ sku: "BGP-GLP1S-5", quantity: 1 }],
      acknowledgment: VALID_ACK,
      payment_method: "wire",
    });

    expect(result.ok).toBe(true);

    // THREE Resend.send calls, in order: customer confirmation, admin
    // notification, then account-claim. We don't lock the order between
    // confirmation/admin (they're Promise.all'd) but the claim email
    // must be the LAST one — it lives outside the Promise.all.
    expect(sentEmails).toHaveLength(3);

    const recipients = sentEmails.map((e) => e.to);
    expect(recipients).toContain(VALID_CUSTOMER.email); // confirmation
    expect(recipients).toContain("admin@test"); // admin notification
    // The claim email must go to the customer.
    const customerEmails = sentEmails.filter(
      (e) => e.to === VALID_CUSTOMER.email
    );
    expect(customerEmails).toHaveLength(2);

    // Account-claim is the third send (after the Promise.all).
    const claim = sentEmails[2];
    expect(claim.to).toBe(VALID_CUSTOMER.email);
    expect(claim.subject.toLowerCase()).toMatch(/account|claim|sign in|access/);
    // The same-origin claim URL must include the token_hash so verifyOtp
    // in /auth/callback can mint the session without bouncing through
    // Supabase's verify endpoint.
    expect(claim.html).toContain("/auth/callback?token_hash=stubclaimtoken123");
    expect(claim.html).toContain("type=magiclink");

    // generateLink was invoked exactly once with the customer email + the
    // /auth/callback redirectTo (the route already wired up linkOrdersToUser).
    expect(generateLinkCalls).toHaveLength(1);
    expect(generateLinkCalls[0].type).toBe("magiclink");
    expect(generateLinkCalls[0].email).toBe(VALID_CUSTOMER.email);
    expect(generateLinkCalls[0].options?.redirectTo).toMatch(/\/auth\/callback/);
  });

  it("I-SUBMIT-3: magic-link signs into existing auth user (no duplicate created)", async () => {
    // Simulate Supabase's behavior when the email already maps to an
    // auth.users row: generateLink returns a link that signs INTO the
    // existing user's id rather than creating a new one. Our
    // contract-level assertion is that we call generateLink with the
    // customer email and dispatch the resulting link via Resend — the
    // single-account-per-email guarantee is Supabase's responsibility.
    resendShouldFire = true;
    nextGenerateLinkResult = {
      data: {
        properties: {
          action_link: "https://stub-magic-link.test/existing",
          hashed_token: "stubexistingtoken",
        },
        user: { id: "existing-user-id-123" },
      },
    };

    const result = await submitOrder({
      customer: VALID_CUSTOMER,
      items: [{ sku: "BGP-GLP1S-5", quantity: 1 }],
      acknowledgment: VALID_ACK,
      payment_method: "wire",
    });
    expect(result.ok).toBe(true);

    expect(generateLinkCalls).toHaveLength(1);
    expect(generateLinkCalls[0]).toMatchObject({
      type: "magiclink",
      email: VALID_CUSTOMER.email,
    });

    // The claim email is dispatched with our same-origin /auth/callback
    // link constructed from generateLink's hashed_token. Whether it
    // signs into a new or existing account is Supabase's call — we
    // only assert the token we received is in the URL we email.
    const claim = sentEmails[sentEmails.length - 1];
    expect(claim.to).toBe(VALID_CUSTOMER.email);
    expect(claim.html).toContain("/auth/callback?token_hash=stubexistingtoken");
  });

  it("I-CHECKOUT-SUB-1: subscription_mode triggers createSubscription + back-links subscription_id on the order", async () => {
    createSubscriptionMock.mockResolvedValueOnce({
      ok: true,
      subscription_id: "sub-uuid-001",
    });

    const result = await submitOrder({
      customer: VALID_CUSTOMER,
      items: [{ sku: "BGP-GLP1S-5", quantity: 1 }],
      acknowledgment: VALID_ACK,
      payment_method: "wire",
      subscription_mode: {
        duration_months: 3,
        payment_cadence: "prepay",
        ship_cadence: "monthly",
      },
    });

    if (!result.ok) throw new Error(`submitOrder failed: ${result.error}`);
    expect(result.ok).toBe(true);

    // createSubscription was invoked exactly once with plan + email + first_order_id.
    expect(createSubscriptionMock).toHaveBeenCalledTimes(1);
    const callArg = createSubscriptionMock.mock.calls[0][0];
    expect(callArg.customer_email).toBe(VALID_CUSTOMER.email);
    expect(callArg.customer_user_id).toBeNull();
    expect(callArg.first_order_id).toBe(result.order_id);
    expect(callArg.plan).toEqual({
      duration_months: 3,
      payment_cadence: "prepay",
      ship_cadence: "monthly",
    });
    // items must be the server-resolved CartItem[] (not the raw client payload).
    expect(Array.isArray(callArg.items)).toBe(true);
    expect((callArg.items[0] as { sku: string }).sku).toBe("BGP-GLP1S-5");

    // Back-link UPDATE: orders.update({ subscription_id }).eq('order_id', order_id)
    const link = updateCalls.find(
      (u) => u.table === "orders" && u.values.subscription_id === "sub-uuid-001"
    );
    expect(link).toBeDefined();
    expect(link?.eq.column).toBe("order_id");
    expect(link?.eq.value).toBe(result.order_id);
  });

  it("codex H1: prepay subscription order persists plan_total upfront (cycle × duration)", async () => {
    // BGP-GLP1S-5 retail $110 × 1 vial = $11000 cents subtotal/cycle.
    // Plan 3-month prepay monthly → 18% discount → cycle_total = 9020;
    // plan_total = 9020 × 3 = 27060.
    const result = await submitOrder({
      customer: VALID_CUSTOMER,
      items: [{ sku: "BGP-GLP1S-5", quantity: 1 }],
      acknowledgment: VALID_ACK,
      payment_method: "wire",
      subscription_mode: {
        duration_months: 3,
        payment_cadence: "prepay",
        ship_cadence: "monthly",
      },
    });
    expect(result.ok).toBe(true);
    const orderRow = insertedRows["orders"]?.[0] as Record<string, unknown>;
    expect(orderRow).toBeDefined();
    // 3-month prepay monthly: 18% off retail × 3 cycles upfront.
    // subtotal_cents = cycle_subtotal × 3 = 11000 × 3 = 33000
    // total_cents = round(11000 × 0.82) × 3 = 9020 × 3 = 27060
    expect(orderRow.subtotal_cents).toBe(33000);
    expect(orderRow.total_cents).toBe(27060);
    // Subscription orders never carry the one-shot free-vial entitlement.
    expect(orderRow.free_vial_entitlement).toBeNull();
  });

  it("codex H1: bill_pay subscription order charges only cycle 1 at checkout", async () => {
    // 6-month bill_pay monthly → 15% off retail; cycle 1 at checkout.
    const result = await submitOrder({
      customer: VALID_CUSTOMER,
      items: [{ sku: "BGP-GLP1S-5", quantity: 1 }],
      acknowledgment: VALID_ACK,
      payment_method: "wire",
      subscription_mode: {
        duration_months: 6,
        payment_cadence: "bill_pay",
        ship_cadence: "monthly",
      },
    });
    expect(result.ok).toBe(true);
    const orderRow = insertedRows["orders"]?.[0] as Record<string, unknown>;
    expect(orderRow).toBeDefined();
    // cycle_subtotal = 11000; cycle_total = round(11000 × 0.85) = 9350.
    expect(orderRow.subtotal_cents).toBe(11000);
    expect(orderRow.total_cents).toBe(9350);
    expect(orderRow.free_vial_entitlement).toBeNull();
  });

  it("I-CHECKOUT-SUB-2: invalid subscription_mode (bill_pay + 1mo) → order rejected by schema", async () => {
    // Duration was narrowed to 3|6|12 in the bulk-buy rewrite — Zod
    // rejects 1 at the schema boundary now. Older codepaths fell
    // through to one-shot; the new contract is stricter (the form
    // can't even produce a 1-month subscription) so this test now
    // asserts the schema-level rejection. The order also doesn't get
    // inserted because validation fails before any DB write.
    const result = await submitOrder({
      customer: VALID_CUSTOMER,
      items: [{ sku: "BGP-GLP1S-5", quantity: 1 }],
      acknowledgment: VALID_ACK,
      payment_method: "wire",
      subscription_mode: {
        duration_months: 1 as unknown as 3,
        payment_cadence: "bill_pay",
        ship_cadence: "monthly",
      },
    });

    expect(result.ok).toBe(false);
    expect(createSubscriptionMock).not.toHaveBeenCalled();
    expect(insertedRows["orders"] ?? []).toHaveLength(0);
  });

  it("account-claim failure does NOT roll back the order (best-effort dispatch)", async () => {
    resendShouldFire = true;
    // Simulate generateLink returning no action_link (e.g. transient
    // Supabase auth-admin failure). The order must still succeed and
    // the customer + admin emails must still have fired.
    nextGenerateLinkResult = { data: { properties: {} } };

    const result = await submitOrder({
      customer: VALID_CUSTOMER,
      items: [{ sku: "BGP-GLP1S-5", quantity: 1 }],
      acknowledgment: VALID_ACK,
      payment_method: "wire",
    });

    expect(result.ok).toBe(true);
    // Two sends — customer + admin — but no third (claim skipped).
    expect(sentEmails).toHaveLength(2);
  });
});
