import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Sprint 1 Task 9 — linkOrdersToUser server action.
 *
 * The action backfills `customer_user_id` on guest orders whose
 * `customer.email` matches the auth user's email. Semantics:
 *   - case-insensitive email match (the migration adds an
 *     `orders_customer_email_lower_idx` index on `lower(customer->>'email')`)
 *   - first-claim-wins: only update rows where `customer_user_id IS NULL`
 *   - idempotent: a second call for the same user finds nothing to
 *     update and returns `{ ok: true, linked: 0 }` without erroring
 *
 * We don't run real Postgres here — we stub `getSupabaseServer()` with a
 * builder whose chain captures every filter call so the test can assert
 * on the WHERE clause.
 */

interface CapturedQuery {
  table?: string;
  update?: Record<string, unknown>;
  filters: Array<{ column: string; op: string; value: unknown }>;
}

interface StubConfig {
  // Rows to return from the chained `.select(...)` step. Keyed by call
  // ordinal so a test calling linkOrdersToUser twice can return
  // different result-sets per call (idempotency check).
  results: Array<Array<{ order_id: string }>>;
  errors?: Array<unknown>;
}

const stubState: { config: StubConfig; queries: CapturedQuery[]; callIdx: number } = {
  config: { results: [[]] },
  queries: [],
  callIdx: 0,
};

function makeBuilder(query: CapturedQuery) {
  const builder: Record<string, unknown> = {
    update(values: Record<string, unknown>) {
      query.update = values;
      return builder;
    },
    filter(column: string, op: string, value: unknown) {
      query.filters.push({ column, op, value });
      return builder;
    },
    select() {
      const idx = stubState.callIdx;
      stubState.callIdx += 1;
      const data = stubState.config.results[idx] ?? [];
      const error = stubState.config.errors?.[idx] ?? null;
      return Promise.resolve({ data, error });
    },
  };
  return builder;
}

function makeStubSupabase() {
  return {
    from(table: string) {
      const query: CapturedQuery = { table, filters: [] };
      stubState.queries.push(query);
      return makeBuilder(query);
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => makeStubSupabase(),
}));

import { linkOrdersToUser } from "../account";

beforeEach(() => {
  stubState.config = { results: [[]] };
  stubState.queries = [];
  stubState.callIdx = 0;
});

describe("linkOrdersToUser — Sprint 1 Task 9 account claim", () => {
  it("I-CLAIM-1: links matching guest orders to the new auth user id", async () => {
    stubState.config = {
      results: [[{ order_id: "ord-1" }, { order_id: "ord-2" }]],
    };
    const result = await linkOrdersToUser("user-abc", "x@y.z");

    expect(result.ok).toBe(true);
    expect(result.linked).toBe(2);

    const q = stubState.queries[0];
    expect(q.table).toBe("orders");
    expect(q.update).toEqual({ customer_user_id: "user-abc" });

    // First-claim guard + email match must both be present.
    const customerUserIdFilter = q.filters.find(
      (f) => f.column === "customer_user_id"
    );
    const emailFilter = q.filters.find(
      (f) => f.column === "customer->>email"
    );
    expect(customerUserIdFilter).toEqual({
      column: "customer_user_id",
      op: "is",
      value: null,
    });
    expect(emailFilter?.op).toBe("ilike");
    expect(emailFilter?.value).toBe("x@y.z");
  });

  it("I-CLAIM-LIKE-ESCAPE: ILIKE wildcards `%` and `_` in the email are escaped", async () => {
    stubState.config = { results: [[{ order_id: "ord-underscore" }]] };
    // RFC-allowed underscore in local-part is the realistic threat:
    // without escaping, `john_doe@x.com` ilike-pattern would match
    // `johnXdoe@x.com` and let the wrong user claim it.
    await linkOrdersToUser("user-escape", "john_doe@x.com");
    const emailFilter = stubState.queries[0].filters.find(
      (f) => f.column === "customer->>email"
    );
    // Underscore must be escaped with a backslash so PG treats it
    // as literal in the LIKE pattern.
    expect(emailFilter?.value).toBe("john\\_doe@x.com");

    stubState.queries = [];
    stubState.config = { results: [[{ order_id: "ord-percent" }]] };
    await linkOrdersToUser("user-escape", "weird%addr@x.com");
    const emailFilter2 = stubState.queries[0].filters.find(
      (f) => f.column === "customer->>email"
    );
    expect(emailFilter2?.value).toBe("weird\\%addr@x.com");
  });

  it("I-CLAIM-2: email match is case-insensitive (lowercases input + uses ilike)", async () => {
    stubState.config = {
      results: [[{ order_id: "ord-mixed" }]],
    };
    const result = await linkOrdersToUser("user-xyz", "Mixed.Case@EXAMPLE.com");

    expect(result.ok).toBe(true);
    expect(result.linked).toBe(1);

    const emailFilter = stubState.queries[0].filters.find(
      (f) => f.column === "customer->>email"
    );
    expect(emailFilter?.op).toBe("ilike");
    // Must be lower-cased + trimmed before being passed as the filter
    // value so it cooperates with the lower(email) index.
    expect(emailFilter?.value).toBe("mixed.case@example.com");
  });

  it("I-CLAIM-3: already-claimed orders are NOT re-claimed (customer_user_id IS NULL guard)", async () => {
    // Stub returns zero rows — simulating that all matching orders
    // already have a non-null customer_user_id, so the IS NULL filter
    // excludes them.
    stubState.config = { results: [[]] };
    const result = await linkOrdersToUser("user-second-claimer", "x@y.z");

    expect(result.ok).toBe(true);
    expect(result.linked).toBe(0);

    // Critical: the IS NULL filter MUST be issued — otherwise a second
    // user with the same email could overwrite the first user's claim.
    const customerUserIdFilter = stubState.queries[0].filters.find(
      (f) => f.column === "customer_user_id"
    );
    expect(customerUserIdFilter).toEqual({
      column: "customer_user_id",
      op: "is",
      value: null,
    });
  });

  it("I-CLAIM-4: idempotent — second call for same user returns linked: 0 without error", async () => {
    // First call links 2 rows; second call finds nothing left.
    stubState.config = {
      results: [
        [{ order_id: "ord-1" }, { order_id: "ord-2" }],
        [],
      ],
    };

    const first = await linkOrdersToUser("user-abc", "x@y.z");
    const second = await linkOrdersToUser("user-abc", "x@y.z");

    expect(first).toEqual({ ok: true, linked: 2 });
    expect(second).toEqual({ ok: true, linked: 0 });
    expect(stubState.queries).toHaveLength(2);
  });

  it("returns ok:false, linked:0 when Supabase is not configured", async () => {
    // Override the mock for this test only — re-import after resetting.
    vi.resetModules();
    vi.doMock("@/lib/supabase/server", () => ({
      getSupabaseServer: () => null,
    }));
    const mod = await import("../account");
    const result = await mod.linkOrdersToUser("user-abc", "x@y.z");
    expect(result).toEqual({ ok: false, linked: 0 });
    vi.doUnmock("@/lib/supabase/server");
  });

  it("returns ok:false, linked:0 when Supabase returns an error", async () => {
    stubState.config = {
      results: [[]],
      errors: [{ message: "boom" }],
    };
    const result = await linkOrdersToUser("user-abc", "x@y.z");
    expect(result).toEqual({ ok: false, linked: 0 });
  });
});
