/**
 * Adversarial RLS integration tests for `public.orders`.
 *
 * Test IDs from sprint-1 plan §A.2:
 *   I-RLS-1  Anon client cannot SELECT any order row
 *   I-RLS-2  Authenticated user A cannot SELECT order owned by user B (canary)
 *   I-RLS-3  Authenticated user A CAN SELECT their own orders
 *   I-RLS-4  RLS policy is SELECT-only — UPDATE/DELETE denied for `authenticated`
 *   I-RLS-5  ruo_acknowledgments is invisible to anon AND authenticated
 *
 * These tests require a live Supabase project. When the env vars are
 * missing (CI without DB), the suite is `describe.skip`-ed and exits clean.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import {
  RLS_TESTS_ENABLED,
  createTestUser,
  signInAsUser,
  insertTestOrder,
  cleanup,
  getAnonClient,
} from "@/test-utils/rls-fixture";
import type { SupabaseClient } from "@supabase/supabase-js";

const d = RLS_TESTS_ENABLED ? describe : describe.skip;

d("RLS: orders.customers_read_own_orders (adversarial)", () => {
  let userA_id: string;
  let userB_id: string;
  let userA_email: string;
  let userB_email: string;
  let orderA_id: string;
  let orderB_id: string;
  let clientA: SupabaseClient;
  let clientB: SupabaseClient;

  beforeAll(async () => {
    // Unique emails per run so re-runs don't collide on auth.users.email.
    const stamp = Date.now() + "-" + randomUUID().slice(0, 8);
    userA_email = `rls-a-${stamp}@bgp-test.invalid`;
    userB_email = `rls-b-${stamp}@bgp-test.invalid`;

    const a = await createTestUser(userA_email);
    const b = await createTestUser(userB_email);
    userA_id = a.id;
    userB_id = b.id;

    const oa = await insertTestOrder(userA_id, userA_email);
    const ob = await insertTestOrder(userB_id, userB_email);
    orderA_id = oa.order_id;
    orderB_id = ob.order_id;

    clientA = await signInAsUser(userA_email);
    clientB = await signInAsUser(userB_email);
  }, 30_000);

  afterAll(async () => {
    await cleanup(
      [userA_id, userB_id].filter(Boolean),
      [orderA_id, orderB_id].filter(Boolean),
    );
  }, 30_000);

  it("I-RLS-1: anon client cannot SELECT any order row", async () => {
    const anon = getAnonClient();
    const { data, error } = await anon
      .from("orders")
      .select("*")
      .in("order_id", [orderA_id, orderB_id]);
    // RLS hides rows; query succeeds but returns empty.
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("I-RLS-3: user A authenticated CAN SELECT their own order", async () => {
    const { data, error } = await clientA
      .from("orders")
      .select("order_id, customer_user_id")
      .eq("order_id", orderA_id);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect((data as Array<{ order_id: string; customer_user_id: string }>)[0].order_id).toBe(
      orderA_id,
    );
  });

  it("I-RLS-2 (canary): user A cannot SELECT user B's order", async () => {
    // If this test ever returns a row, the RLS policy is broken — STOP.
    const { data, error } = await clientA
      .from("orders")
      .select("*")
      .eq("order_id", orderB_id);
    expect(error).toBeNull();
    expect(data).toEqual([]);

    // And the converse, for symmetry.
    const { data: data2 } = await clientB
      .from("orders")
      .select("*")
      .eq("order_id", orderA_id);
    expect(data2).toEqual([]);
  });

  it("I-RLS-4: authenticated user cannot UPDATE or DELETE their own order", async () => {
    // UPDATE: postgres returns no error but RLS USING-only policy means 0 rows
    // updated. Verify the row is unchanged via the service role.
    const updateResult = await clientA
      .from("orders")
      .update({ status: "shipped" })
      .eq("order_id", orderA_id)
      .select();
    // Either the API errors OR returns an empty changeset — both are acceptable
    // proofs of deny; what is NOT acceptable is the row actually mutating.
    if (!updateResult.error) {
      expect(updateResult.data ?? []).toEqual([]);
    }

    const deleteResult = await clientA
      .from("orders")
      .delete()
      .eq("order_id", orderA_id)
      .select();
    if (!deleteResult.error) {
      expect(deleteResult.data ?? []).toEqual([]);
    }

    // Verify via service role: row still exists with its original status.
    const svc = (await import("@/test-utils/rls-fixture")).getServiceClient();
    const { data: stillThere } = await svc
      .from("orders")
      .select("order_id, status")
      .eq("order_id", orderA_id);
    expect(stillThere).toHaveLength(1);
    expect(
      (stillThere as Array<{ order_id: string; status: string }>)[0].status,
    ).toBe("awaiting_wire");
  });

  it("I-RLS-5: ruo_acknowledgments is invisible to anon AND authenticated (no policy)", async () => {
    const anon = getAnonClient();
    const { data: anonData, error: anonErr } = await anon
      .from("ruo_acknowledgments")
      .select("*")
      .limit(1);
    // No policy on the table → empty result for non-service callers.
    expect(anonErr).toBeNull();
    expect(anonData).toEqual([]);

    const { data: authData, error: authErr } = await clientA
      .from("ruo_acknowledgments")
      .select("*")
      .limit(1);
    expect(authErr).toBeNull();
    expect(authData).toEqual([]);
  });
});
