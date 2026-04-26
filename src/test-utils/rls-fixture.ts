/**
 * RLS adversarial-test fixture helpers.
 *
 * These helpers spin up real auth.users + public.orders rows against a live
 * Supabase project (using the service-role key for admin operations) so we
 * can exercise the RLS policy from BOTH sides — anon and authenticated —
 * and verify cross-tenant isolation.
 *
 * Tests using this fixture must skip gracefully when the Supabase env vars
 * are not configured (CI without DB access). See `src/app/api/auth/__tests__/rls.test.ts`
 * for the `describe.skip` pattern.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

function requireEnv(): { url: string; anon: string; service: string } {
  if (!URL || !ANON || !SERVICE) {
    throw new Error(
      "rls-fixture requires NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, " +
        "and SUPABASE_SERVICE_ROLE_KEY to be set",
    );
  }
  return { url: URL, anon: ANON, service: SERVICE };
}

/** Service-role admin client. Bypasses RLS. Used for setup & teardown. */
export function getServiceClient(): SupabaseClient {
  const { url, service } = requireEnv();
  return createClient(url, service, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Anonymous client (publishable / anon key). Subject to RLS. */
export function getAnonClient(): SupabaseClient {
  const { url, anon } = requireEnv();
  return createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// We stash a deterministic password on each test user so we can sign in as
// them via the anon client and obtain a real `authenticated` JWT. The
// password never leaves this fixture; users are deleted in cleanup().
const TEST_PASSWORD = "rls-fixture-pw-Aa1!" + randomUUID();

/**
 * Create an auth.users row with a known password via the admin API.
 * Returns the user id + email. Email must be unique per call.
 */
export async function createTestUser(
  email: string,
): Promise<{ id: string; email: string }> {
  const svc = getServiceClient();
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`createTestUser failed: ${error?.message ?? "no user returned"}`);
  }
  return { id: data.user.id, email };
}

/**
 * Return an anon-key Supabase client that is signed in as the given user.
 * Uses password sign-in against the password set in createTestUser().
 * The returned client carries an `authenticated` JWT, so RLS policies on
 * the `authenticated` role apply.
 */
export async function signInAsUser(email: string): Promise<SupabaseClient> {
  const client = getAnonClient();
  const { error } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (error) {
    throw new Error(`signInAsUser failed for ${email}: ${error.message}`);
  }
  return client;
}

/**
 * Insert a minimal valid order row owned by `customerUserId`. Returns the
 * order_id. Uses the service-role client so RLS does not interfere with
 * setup. Mirrors the schema in 0001_init_orders.sql + 0004_*.sql.
 */
export async function insertTestOrder(
  customerUserId: string,
  email: string,
): Promise<{ order_id: string }> {
  const svc = getServiceClient();
  const order_id = randomUUID();
  const { error } = await svc.from("orders").insert({
    order_id,
    customer: {
      name: "RLS Fixture",
      email,
      ship_address_1: "1 Test Ln",
      ship_city: "Boston",
      ship_state: "MA",
      ship_zip: "02101",
    },
    items: [
      {
        sku: "BGP-RLS-FIXTURE-1",
        product_slug: "rls-fixture",
        category_slug: "test",
        name: "RLS Fixture Vial",
        size_mg: 10,
        pack_size: 1,
        unit_price: 1,
        quantity: 1,
      },
    ],
    subtotal_cents: 100,
    acknowledgment: {
      certification_text: "rls-fixture",
      certification_hash: "rls-fixture-hash",
      is_adult: true,
      is_researcher: true,
      accepts_ruo: true,
      acknowledged_at: new Date().toISOString(),
    },
    status: "awaiting_wire",
    customer_user_id: customerUserId,
  });
  if (error) {
    throw new Error(`insertTestOrder failed: ${error.message}`);
  }
  return { order_id };
}

/**
 * Tear down test rows. Orders are deleted first (FK on auth.users is
 * ON DELETE SET NULL, so the order would survive — we delete it explicitly
 * to keep the DB clean). Best-effort: we swallow per-row errors so a
 * partial cleanup still proceeds.
 */
export async function cleanup(
  userIds: string[],
  orderIds: string[],
): Promise<void> {
  const svc = getServiceClient();
  for (const orderId of orderIds) {
    await svc.from("orders").delete().eq("order_id", orderId);
  }
  for (const userId of userIds) {
    await svc.auth.admin.deleteUser(userId);
  }
}

/** True iff the env vars needed to run RLS integration tests are present. */
export const RLS_TESTS_ENABLED = !!(URL && ANON && SERVICE);
