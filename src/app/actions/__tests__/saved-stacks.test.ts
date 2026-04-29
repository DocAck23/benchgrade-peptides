import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted lifts state above the vi.mock factories so the mocks
// can reference it without TDZ errors.
interface FakeSavedRow {
  id: string;
  user_id: string;
  name: string;
  lines: Array<{ sku: string; quantity: number }>;
  created_at: string;
  updated_at: string;
}

const state = vi.hoisted(() => ({
  rows: [] as FakeSavedRow[],
  authedUserId: null as string | null,
  /** When set, simulates a unique-violation on the next insert/update. */
  forceUnique: false,
  countOverride: null as number | null,
}));

vi.mock("@/lib/supabase/client", () => ({
  createServerSupabase: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: state.authedUserId ? { id: state.authedUserId } : null },
        error: null,
      }),
    },
    from: (table: string) => {
      if (table === "saved_stacks") {
        return {
          select: () => ({
            eq: (_c1: string, v1: string) => ({
              eq: (c2: string, v2: string) => ({
                async maybeSingle() {
                  if (c2 === "user_id") {
                    const row = state.rows.find(
                      (r) => r.id === v1 && r.user_id === v2,
                    );
                    return { data: row ?? null, error: null };
                  }
                  return { data: null, error: null };
                },
              }),
              order: () => ({
                async then(
                  resolve: (v: {
                    data: FakeSavedRow[];
                    error: null;
                  }) => void,
                ) {
                  // Cookie-scoped read — already RLS-filtered server-side; we
                  // simulate by filtering on user_id client-side in tests.
                  resolve({
                    data: state.rows.filter(
                      (r) => r.user_id === state.authedUserId,
                    ),
                    error: null,
                  });
                },
              }),
            }),
          }),
        };
      }
      return {} as never;
    },
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServer: () => ({
    from: (table: string) => {
      if (table === "saved_stacks") {
        return {
          select: (_cols: string, opts?: { count?: string; head?: boolean }) => ({
            eq: (col1: string, val1: string) => {
              if (opts?.head && opts?.count === "exact") {
                return {
                  async then(
                    resolve: (v: {
                      data: null;
                      count: number;
                      error: null;
                    }) => void,
                  ) {
                    const count =
                      state.countOverride ??
                      state.rows.filter((r) => r.user_id === val1).length;
                    resolve({ data: null, count, error: null });
                  },
                };
              }
              return {
                eq: (_col2: string, val2: string) => ({
                  async maybeSingle() {
                    const row = state.rows.find(
                      (r) => r.id === val1 && r.user_id === val2,
                    );
                    return { data: row ?? null, error: null };
                  },
                }),
              };
            },
          }),
          insert: (payload: Omit<FakeSavedRow, "id" | "created_at" | "updated_at">) => {
            if (state.forceUnique) {
              state.forceUnique = false;
              return {
                select: () => ({
                  async single() {
                    return {
                      data: null,
                      error: { code: "23505", message: "unique violation" },
                    };
                  },
                }),
              };
            }
            // Manual unique check on (user_id, lower(name)).
            const dup = state.rows.find(
              (r) =>
                r.user_id === payload.user_id &&
                r.name.toLowerCase() === payload.name.toLowerCase(),
            );
            if (dup) {
              return {
                select: () => ({
                  async single() {
                    return {
                      data: null,
                      error: { code: "23505", message: "unique violation" },
                    };
                  },
                }),
              };
            }
            const row: FakeSavedRow = {
              id: `row-${state.rows.length + 1}`,
              user_id: payload.user_id,
              name: payload.name,
              lines: payload.lines,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            state.rows.push(row);
            return {
              select: () => ({
                async single() {
                  return { data: { id: row.id }, error: null };
                },
              }),
            };
          },
          update: (changes: Partial<FakeSavedRow>) => ({
            eq: (_c1: string, v1: string) => ({
              eq: (_c2: string, v2: string) => ({
                async then(
                  resolve: (v: {
                    data: null;
                    error: { code: string; message: string } | null;
                  }) => void,
                ) {
                  const idx = state.rows.findIndex(
                    (r) => r.id === v1 && r.user_id === v2,
                  );
                  if (idx === -1) {
                    resolve({ data: null, error: null });
                    return;
                  }
                  // Manual unique check on rename.
                  if (
                    typeof changes.name === "string" &&
                    state.rows.some(
                      (r) =>
                        r.id !== v1 &&
                        r.user_id === v2 &&
                        r.name.toLowerCase() === changes.name!.toLowerCase(),
                    )
                  ) {
                    resolve({
                      data: null,
                      error: { code: "23505", message: "unique violation" },
                    });
                    return;
                  }
                  state.rows[idx] = {
                    ...state.rows[idx],
                    ...changes,
                    updated_at: new Date().toISOString(),
                  };
                  resolve({ data: null, error: null });
                },
              }),
            }),
          }),
          delete: () => ({
            eq: (_c1: string, v1: string) => ({
              eq: (_c2: string, v2: string) => ({
                select: () => ({
                  async then(
                    resolve: (v: {
                      data: Array<{ id: string }>;
                      error: null;
                    }) => void,
                  ) {
                    const idx = state.rows.findIndex(
                      (r) => r.id === v1 && r.user_id === v2,
                    );
                    if (idx === -1) {
                      resolve({ data: [], error: null });
                      return;
                    }
                    const removed = state.rows[idx];
                    state.rows.splice(idx, 1);
                    resolve({ data: [{ id: removed.id }], error: null });
                  },
                }),
              }),
            }),
          }),
        };
      }
      return {} as never;
    },
  }),
}));

import {
  saveStack,
  listMyStacks,
  deleteSavedStack,
  loadSavedStack,
} from "../saved-stacks";

const USER_A = "11111111-1111-4111-8111-111111111111";
const USER_B = "22222222-2222-4222-8222-222222222222";
const VALID_LINE = { sku: "BGP-BPC-5", quantity: 1 };

beforeEach(() => {
  state.rows.length = 0;
  state.authedUserId = null;
  state.forceUnique = false;
  state.countOverride = null;
});

describe("saveStack", () => {
  it("rejects when no user is signed in", async () => {
    state.authedUserId = null;
    const res = await saveStack({ name: "Test", lines: [VALID_LINE] });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/sign in/i);
  });

  it("rejects empty stack lines", async () => {
    state.authedUserId = USER_A;
    const res = await saveStack({ name: "Empty", lines: [] });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/at least one/i);
  });

  it("rejects unknown SKUs against the catalog", async () => {
    state.authedUserId = USER_A;
    const res = await saveStack({
      name: "Bad",
      lines: [{ sku: "BGP-FAKE-99", quantity: 1 }],
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/unknown sku/i);
  });

  it("rejects duplicate SKUs in the same stack", async () => {
    state.authedUserId = USER_A;
    const res = await saveStack({
      name: "Dup",
      lines: [VALID_LINE, VALID_LINE],
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/duplicate/i);
  });

  it("rejects names longer than 100 chars", async () => {
    state.authedUserId = USER_A;
    const res = await saveStack({
      name: "A".repeat(101),
      lines: [VALID_LINE],
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/too long/i);
  });

  it("rejects more than 20 distinct SKUs", async () => {
    state.authedUserId = USER_A;
    const lines = Array.from({ length: 21 }, (_, i) => ({
      sku: `BGP-FAKE-${i}`,
      quantity: 1,
    }));
    const res = await saveStack({ name: "Big", lines });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/up to 20/i);
  });

  it("inserts a new stack on success", async () => {
    state.authedUserId = USER_A;
    const res = await saveStack({
      name: "Recovery",
      lines: [VALID_LINE],
    });
    expect(res.ok).toBe(true);
    expect(res.id).toBe("row-1");
    expect(state.rows).toHaveLength(1);
    expect(state.rows[0].user_id).toBe(USER_A);
    expect(state.rows[0].name).toBe("Recovery");
  });

  it("surfaces unique-name collision as a friendly message", async () => {
    state.authedUserId = USER_A;
    state.rows.push({
      id: "row-1",
      user_id: USER_A,
      name: "Recovery",
      lines: [VALID_LINE],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const res = await saveStack({
      name: "Recovery",
      lines: [VALID_LINE],
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/already have a stack named/i);
  });

  it("enforces the 50-stack-per-user cap", async () => {
    state.authedUserId = USER_A;
    state.countOverride = 50;
    const res = await saveStack({
      name: "OverCap",
      lines: [VALID_LINE],
    });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/maximum of 50/i);
  });
});

describe("listMyStacks", () => {
  it("returns empty list for anonymous users", async () => {
    state.authedUserId = null;
    const res = await listMyStacks();
    expect(res.ok).toBe(true);
    expect(res.stacks).toHaveLength(0);
  });

  it("returns only the caller's rows", async () => {
    state.rows.push({
      id: "a1",
      user_id: USER_A,
      name: "MineA",
      lines: [VALID_LINE],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    state.rows.push({
      id: "b1",
      user_id: USER_B,
      name: "MineB",
      lines: [VALID_LINE],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    state.authedUserId = USER_A;
    const res = await listMyStacks();
    expect(res.ok).toBe(true);
    expect(res.stacks).toHaveLength(1);
    expect(res.stacks[0].id).toBe("a1");
  });
});

describe("deleteSavedStack", () => {
  it("rejects when not authenticated", async () => {
    state.authedUserId = null;
    const res = await deleteSavedStack(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(res.ok).toBe(false);
  });

  it("returns not-found when deleting a stack owned by someone else", async () => {
    state.authedUserId = USER_A;
    state.rows.push({
      id: "00000000-0000-4000-8000-000000000001",
      user_id: USER_B,
      name: "TheirStack",
      lines: [VALID_LINE],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const res = await deleteSavedStack(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not found/i);
    expect(state.rows).toHaveLength(1); // not deleted
  });

  it("removes the caller's own row on success", async () => {
    state.authedUserId = USER_A;
    state.rows.push({
      id: "00000000-0000-4000-8000-000000000002",
      user_id: USER_A,
      name: "Mine",
      lines: [VALID_LINE],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const res = await deleteSavedStack(
      "00000000-0000-4000-8000-000000000002",
    );
    expect(res.ok).toBe(true);
    expect(state.rows).toHaveLength(0);
  });
});

describe("loadSavedStack", () => {
  it("filters out lines whose SKU no longer exists", async () => {
    state.authedUserId = USER_A;
    state.rows.push({
      id: "00000000-0000-4000-8000-000000000003",
      user_id: USER_A,
      name: "Vintage",
      lines: [
        VALID_LINE,
        { sku: "BGP-RETIRED-99", quantity: 1 },
      ],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const res = await loadSavedStack(
      "00000000-0000-4000-8000-000000000003",
    );
    expect(res.ok).toBe(true);
    expect(res.stack?.lines).toHaveLength(1);
    expect(res.stack?.dropped_skus).toEqual(["BGP-RETIRED-99"]);
  });

  it("clamps quantities exceeding the per-line cap", async () => {
    state.authedUserId = USER_A;
    state.rows.push({
      id: "00000000-0000-4000-8000-000000000004",
      user_id: USER_A,
      name: "Heavy",
      lines: [{ sku: "BGP-BPC-5", quantity: 999 }],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const res = await loadSavedStack(
      "00000000-0000-4000-8000-000000000004",
    );
    expect(res.ok).toBe(true);
    expect(res.stack?.lines[0].quantity).toBe(20);
  });

  it("returns not-found for a stack the caller doesn't own", async () => {
    state.authedUserId = USER_B;
    state.rows.push({
      id: "00000000-0000-4000-8000-000000000005",
      user_id: USER_A,
      name: "TheirStack",
      lines: [VALID_LINE],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const res = await loadSavedStack(
      "00000000-0000-4000-8000-000000000005",
    );
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not found/i);
  });
});
