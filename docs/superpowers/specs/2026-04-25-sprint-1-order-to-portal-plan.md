# Sprint 1 — Order → Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the post-purchase customer experience core — tracking + 3 new transactional emails, Supabase Auth magic-link with auto-claim, customer portal (read-only orders + COA), Stack & Save discount engine with live cart progress, and the `/why-no-cards` narrative — all without touching Sprint 0 visual rebrand assets.

**Architecture:** Additive on top of the existing `orders` table; new `customer_user_id` FK to `auth.users` (nullable, claimed by email match). RLS policies restrict customer reads to their own rows; service role retains admin/server access. Three new pure-function email templates compose the existing payment-instruction blocks. Stack & Save is a pure discount engine (`src/lib/cart/discounts.ts`) called from both client cart UI and server-side `submitOrder` validation — never trust client-supplied discounts.

**Tech Stack:** Next.js 16.2.4 (app router, server actions, route handlers), React 19.2.4, Tailwind v4, Supabase (`@supabase/ssr` + `@supabase/supabase-js`), Resend, Vitest, Zod.

**Spec source:** [docs/superpowers/specs/2026-04-25-v1-customer-experience-design.md](2026-04-25-v1-customer-experience-design.md). Read §2, §3, §5, §9.1, §9.3, §10, §11, §16.4, §17 before starting.

---

## §A · Test plan (write before any production code)

Per spec §17.1, tests are planned and written **before** implementation. This section enumerates every behaviour the sprint must verify. Code tasks reference these by ID.

### A.1 — Unit (pure functions, vitest)

| ID | Subject | Behaviour |
|---|---|---|
| U-DISC-1 | `computeStackSaveDiscount` | 0 vials → no discount, no free shipping |
| U-DISC-2 | `computeStackSaveDiscount` | 1 vial → no tier discount, paid shipping |
| U-DISC-3 | `computeStackSaveDiscount` | 2 vials → free shipping, no tier % |
| U-DISC-4 | `computeStackSaveDiscount` | 3 vials → 15% off + free shipping |
| U-DISC-5 | `computeStackSaveDiscount` | 4 vials → still 15% (no 4-tier) |
| U-DISC-6 | `computeStackSaveDiscount` | 5 vials → 20% off + free shipping |
| U-DISC-7 | `computeStackSaveDiscount` | 7 vials → still 20% |
| U-DISC-8 | `computeStackSaveDiscount` | 8 vials → 25% + free 5mg vial entitlement |
| U-DISC-9 | `computeStackSaveDiscount` | 12 vials → 28% + free 10mg vial entitlement |
| U-DISC-10 | `computeStackSaveDiscount` | 20 vials → still 28% (cap is 12+) |
| U-DISC-11 | `nextStackSaveTier` | At 1 vial returns target=2, message="Add 1 more vial — unlock free domestic shipping" |
| U-DISC-12 | `nextStackSaveTier` | At 4 vials returns target=5, message about 20% off |
| U-DISC-13 | `nextStackSaveTier` | At 12+ vials returns null (no next tier) |
| U-MULT-1 | `computeSameSkuMultiplier` | All distinct SKUs → no multiplier |
| U-MULT-2 | `computeSameSkuMultiplier` | 4 of same SKU → no multiplier (threshold is 5) |
| U-MULT-3 | `computeSameSkuMultiplier` | 5 of same SKU → 5% off |
| U-MULT-4 | `computeSameSkuMultiplier` | 5 of one SKU + 3 of another → 5% off (only one SKU triggers) |
| U-MULT-5 | `computeSameSkuMultiplier` | 5 of one SKU + 5 of another → still 5% off (capped, not stacked) |
| U-COMBO-1 | `computeCartTotals` | 5 vials of same SKU at $100 each = subtotal $500 → Stack&Save 20% then SameSKU 5% applied to remaining → final consistent with documented order-of-operations |
| U-COMBO-2 | `computeCartTotals` | 8 vials, 5 of same SKU + 3 distinct → 25% Stack&Save + 5% SameSKU + free 5mg vial entitlement |
| U-COMBO-3 | `computeCartTotals` | When tier-discount calculation rounds, `discount_cents` totals match per-line allocation (no rounding loss) |
| U-EMAIL-PC-1 | `paymentConfirmedEmail` | Subject is `"Payment received — your order is being prepared · BGP-<first8>"` |
| U-EMAIL-PC-2 | `paymentConfirmedEmail` | Body shows order summary with all items + final total (re-rendered, not echoed from any client value) |
| U-EMAIL-PC-3 | `paymentConfirmedEmail` | Body includes RUO disclaimer in footer |
| U-EMAIL-PC-4 | `paymentConfirmedEmail` | Customer name HTML-escaped in both `html` and `text` fields |
| U-EMAIL-SH-1 | `orderShippedEmail` | Subject is `"Shipped — tracking inside · BGP-<first8>"` |
| U-EMAIL-SH-2 | `orderShippedEmail` | Body includes tracking number, carrier name, tracking URL |
| U-EMAIL-SH-3 | `orderShippedEmail` | Body includes the storage-and-handling panel (lyo 2–8°C, light-protect, reconstituted shelf-life note) |
| U-EMAIL-SH-4 | `orderShippedEmail` | Body includes a per-lot COA URL placeholder when `coa_lot_urls` is provided |
| U-EMAIL-SH-5 | `orderShippedEmail` | Body when `coa_lot_urls` is empty falls back to "COA available in your portal" link |
| U-EMAIL-CL-1 | `accountClaimEmail` | Subject is `"Claim your Bench Grade portal — order BGP-<first8>"` |
| U-EMAIL-CL-2 | `accountClaimEmail` | Body includes the magic-link CTA URL exactly as supplied |
| U-EMAIL-CL-3 | `accountClaimEmail` | Body explains "click any future magic link from us — same account" |
| U-AUTH-1 | `requestMagicLink` action | Empty email → returns `{ ok: false, error: "Email required." }` |
| U-AUTH-2 | `requestMagicLink` action | Malformed email → returns validation error |
| U-AUTH-3 | `requestMagicLink` action | Valid email → calls `supabase.auth.signInWithOtp` with redirect to `/auth/callback` and returns `{ ok: true }` |
| U-AUTH-4 | `requestMagicLink` action | Rate-limited (3 requests / 5 min same IP) → returns rate-limit error |

### A.2 — Integration (against local Supabase, vitest)

| ID | Subject | Behaviour |
|---|---|---|
| I-MIG-1 | Migration 0004 | Adds `tracking_number text`, `tracking_carrier text`, `shipped_at timestamptz` columns; existing rows unaffected |
| I-MIG-2 | Migration 0004 | Adds `customer_user_id uuid` FK to `auth.users(id)` ON DELETE SET NULL; nullable |
| I-MIG-3 | Migration 0005 | Creates RLS policy `customers_read_own_orders` allowing SELECT where `customer_user_id = auth.uid()` |
| I-MIG-4 | Migration 0005 | Service role still bypasses RLS (existing behaviour) |
| I-RLS-1 | Adversarial RLS | Anon client cannot SELECT any order row |
| I-RLS-2 | Adversarial RLS | Authenticated user A cannot SELECT order owned by user B |
| I-RLS-3 | Adversarial RLS | Authenticated user A CAN SELECT their own orders (`customer_user_id = auth.uid()`) |
| I-RLS-4 | Adversarial RLS | RLS policy SELECT-only — UPDATE/DELETE forbidden for `authenticated` role even on own rows |
| I-RLS-5 | Adversarial RLS | `ruo_acknowledgments` remains service-role-only (no policy added) — anon and authenticated both denied |
| I-CLAIM-1 | `linkOrdersToUser` | New auth.users record with email `x@y.z` + existing orders.customer.email `x@y.z` → orders' `customer_user_id` set to that user's id |
| I-CLAIM-2 | `linkOrdersToUser` | Email match is case-insensitive (Postgres `lower(email)`) |
| I-CLAIM-3 | `linkOrdersToUser` | Already-claimed orders (non-null `customer_user_id`) are NOT re-claimed by a different user with same email — first-claim-wins guarded by `customer_user_id IS NULL` predicate |
| I-CLAIM-4 | `linkOrdersToUser` | Idempotent: calling twice for same user does not duplicate or error |
| I-WEBHOOK-1 | NowPayments webhook | When status flips to `funded`, `paymentConfirmedEmail` is dispatched once |
| I-WEBHOOK-2 | NowPayments webhook | Concurrent IPN arrivals for the same order do not double-send the email (UPDATE-then-check-rowcount semantics) |
| I-WEBHOOK-3 | NowPayments webhook | Email dispatch failure does NOT roll back the status flip — status durability > email |
| I-ADMIN-1 | `markOrderFunded(orderId)` | Admin-only (cookie check) — non-admin caller returns Unauthorized |
| I-ADMIN-2 | `markOrderFunded(orderId)` | Status flips `awaiting_payment` → `funded`; `paymentConfirmedEmail` fires |
| I-ADMIN-3 | `markOrderFunded(orderId)` | Status flip from `funded` → `funded` is a no-op (no second email) |
| I-ADMIN-4 | `markOrderShipped(orderId, trackingNumber, carrier)` | Tracking validated (non-empty, length-bounded); status flips to `shipped`; `tracking_number`/`tracking_carrier`/`shipped_at` populated; `orderShippedEmail` fires |
| I-ADMIN-5 | `markOrderShipped` | Tracking number arriving without status flip first → rejected (must transition through `funded`) |
| I-SUBMIT-1 | `submitOrder` integration | Stack & Save discount and Same-SKU multiplier are computed server-side from validated cart lines; client-supplied discount fields (if any) are ignored |
| I-SUBMIT-2 | `submitOrder` | New row `customer_user_id` is nullable on insert; account_claim_email fires alongside the existing order-confirmation email |
| I-SUBMIT-3 | `submitOrder` | When the order email already exists in `auth.users`, the magic-link in account_claim_email signs INTO that account (not creates a duplicate) |

### A.3 — Component / UI (Vitest with happy-dom or smoke via Claude Preview)

| ID | Subject | Behaviour |
|---|---|---|
| C-CART-1 | `<CartDrawer/>` | At 1 vial, shows "Add 1 more vial — unlock free domestic shipping" with progress bar at ~50% |
| C-CART-2 | `<CartDrawer/>` | At 3 vials, shows 15% off applied line item with red strike-through subtotal |
| C-CART-3 | `<CartDrawer/>` | Tier-transition (2→3 vials by `+` button click) updates discount line in <100ms |
| C-CART-4 | `<CartDrawer/>` | At 8 vials, shows "Free 5mg vial of choice unlocked" message with "select at checkout" hint |
| C-CHECKOUT-1 | `<CheckoutPageClient/>` | Order summary aside reflects same totals as cart drawer for identical cart |
| C-CHECKOUT-2 | `<CheckoutPageClient/>` | Card-processor footnote is rendered under the payment selector with link to `/why-no-cards` |
| C-CHECKOUT-3 | `<CheckoutPageClient/>` | Trust strip + free-ship progress bar + next-steps timeline still render (already shipped in earlier work — regression check) |
| C-PORTAL-1 | `/account` | Unauthenticated visit redirects to `/login?redirect=/account` |
| C-PORTAL-2 | `/account` | Authenticated visit shows recent-orders card, message-thread CTA, referral-link CTA |
| C-PORTAL-3 | `/account/orders` | Lists only the authenticated user's orders, sorted desc by `created_at` |
| C-PORTAL-4 | `/account/orders/[id]` | Owner can view; non-owner gets 404 (RLS-driven, no info leak) |
| C-PORTAL-5 | `/account/orders/[id]` | Renders status timeline (placed → funded → shipped → delivered with timestamps) |
| C-PORTAL-6 | `/account/orders/[id]` | Tracking link present when `tracking_number` set |
| C-PORTAL-7 | `/why-no-cards` | Renders the editorial narrative; SEO meta tags present (`title`, `description`, `og:`) |

### A.4 — Manual UI verification via Claude Preview

| ID | Surface | Action |
|---|---|---|
| M-1 | Cart drawer with 1, 2, 3, 5, 8, 12 vials | Visual check: progress bar, tier message, totals correct; transitions feel smooth |
| M-2 | Checkout page | Footnote under payment selector links to `/why-no-cards`; opens cleanly |
| M-3 | Magic-link request | Submit email → success state shown; landing email arrives within 30s |
| M-4 | Magic-link callback | Click link in email → lands at `/account` signed in |
| M-5 | `/account/orders` after first order | Order appears with correct status pill |
| M-6 | `/account/orders/[id]` after status flips | Timeline updates on refresh; tracking link works |
| M-7 | `/why-no-cards` | Editorial copy reads as drafted; not crawled by AI training bots (matches `robots.txt` rules) |

---

## §B · File structure

### Files to create

```
supabase/migrations/
  0004_add_tracking_and_customer_user.sql   # tracking columns + customer_user_id FK
  0005_orders_rls_customer_read.sql         # RLS policies for self-read

src/lib/cart/
  discounts.ts                              # pure discount engine (Stack & Save + Same-SKU)
  __tests__/discounts.test.ts               # U-DISC-*, U-MULT-*, U-COMBO-*

src/lib/email/
  templates.ts                              # MODIFIED — add 3 new exported builders
  __tests__/templates.test.ts               # MODIFIED — add U-EMAIL-PC-*, U-EMAIL-SH-*, U-EMAIL-CL-*

src/lib/orders/
  status-transitions.ts                     # NEW — pure functions: legalNextStatus(), describeTransition()
  __tests__/status-transitions.test.ts      # transition matrix tests

src/lib/auth/
  rate-limit.ts                             # rate-limit wrapper for requestMagicLink (3/5min/IP)

src/app/actions/
  auth.ts                                   # NEW — requestMagicLink, signOut server actions
  account.ts                                # NEW — linkOrdersToUser
  admin.ts                                  # MODIFIED — add markOrderFunded, markOrderShipped (replaces updateOrderStatus for funded/shipped)

src/app/auth/callback/
  route.ts                                  # NEW — magic-link callback handler

src/app/login/
  page.tsx                                  # NEW — magic-link request form
  LoginForm.tsx                             # NEW — client form

src/app/account/
  page.tsx                                  # MODIFIED — replace stub with dashboard
  layout.tsx                                # NEW — auth gate + nav

src/app/account/orders/
  page.tsx                                  # NEW — list view
  [id]/
    page.tsx                                # NEW — detail view

src/app/why-no-cards/
  page.tsx                                  # NEW — editorial narrative

src/components/account/
  OrderStatusPill.tsx                       # NEW — visual status badge
  OrderTimeline.tsx                         # NEW — vertical timeline of status changes
  AccountNav.tsx                            # NEW — portal sidebar/tab nav

src/components/cart/
  StackSaveProgress.tsx                     # NEW — live tier progress bar
  CartDrawer.tsx                            # MODIFIED — render StackSaveProgress + discount lines

src/components/checkout/
  CardProcessorFootnote.tsx                 # NEW — small italic text under payment selector

src/lib/email/notifications/
  send-order-emails.ts                      # NEW — single helper to dispatch any of the new emails (Resend wrap)

src/middleware.ts                           # NEW — /account auth gate

src/app/api/auth/
  __tests__/rls.test.ts                     # NEW — adversarial RLS integration tests (uses anon + authenticated clients)
```

### Files to modify

```
src/lib/orders/status.ts                    # add `delivered` status (optional, used by timeline; webhook still doesn't fire it)
src/lib/supabase/types.ts                   # OrderRow gains tracking_number?, tracking_carrier?, shipped_at?, customer_user_id? fields
src/lib/cart/CartContext.tsx                # expose discount state via CartApi (computed from items via discounts.ts)
src/lib/cart/types.ts                       # CartApi adds discount/total getters
src/app/checkout/CheckoutPageClient.tsx     # add CardProcessorFootnote under payment selector; render Stack&Save lines in summary aside
src/app/actions/orders.ts                   # in submitOrder: compute discounts server-side, fire account-claim email alongside confirmation
src/app/api/webhook/nowpayments/route.ts    # on funded transition, dispatch paymentConfirmedEmail
src/components/layout/Header.tsx            # show "Sign in" / "Account" depending on auth state
src/lib/email/client.ts                     # if RESEND_FROM_EMAIL env var path for FROM address (already coded — verify only)
.env.example                                # add NEXT_PUBLIC_SUPABASE_ANON_KEY (likely present), AUTH_REDIRECT_URL
```

### Files to leave untouched (intentional)

- `src/lib/payments/methods.ts` — payment rails locked
- `src/lib/payments/nowpayments/webhook.ts` — only the route handler changes (signature/canonicalize logic is stable)
- `src/lib/compliance/*` — RUO framework unchanged in this sprint
- Catalog data + variants — pricing locked
- `src/components/compliance/RUOGate.tsx` — RUO modal unchanged

---

## §C · Codex review checkpoint #1 (plan-level)

Per spec §17.1 step 3. **Before any code is written**, this plan is handed to Codex via `codex:rescue` for adversarial critique.

### How to run

- [ ] **Step C.1: Invoke `codex:rescue` with the plan + spec**

  ```
  Spawn codex:rescue with:
    Read: docs/superpowers/specs/2026-04-25-v1-customer-experience-design.md (whole file)
    Read: docs/superpowers/specs/2026-04-25-sprint-1-order-to-portal-plan.md (this file)
    Question: "Adversarial review of this Sprint 1 plan against the linked spec.
    Surface anything missed, overengineered, ambiguous, racy, or wrong.
    Critical concerns to scrutinize:
      - Order email collisions (claim flow correctness when same email is used twice)
      - RLS policies (any way an authenticated user could read another user's orders?)
      - Stack & Save server-side enforcement (can a malicious client bypass and submit a discounted total?)
      - Magic-link redirect/state validation (open redirect risk)
      - Race between NowPayments webhook funded-flip and admin manual funded-flip
      - Tracking number arriving before status reaches `funded`
    Categorize findings High / Medium / Low with concrete fix suggestions."
  ```

- [ ] **Step C.2: Resolve High and Medium findings inline in this plan**
  Edit the plan, add tasks, or add tests as required. Mark each Codex finding as Resolved with a one-line note pointing to the plan location that handles it.

- [ ] **Step C.3: Commit the resolved plan**

  ```bash
  git add docs/superpowers/specs/2026-04-25-sprint-1-order-to-portal-plan.md
  git commit -m "docs: sprint 1 plan — codex review #1 resolved"
  ```

**Do NOT proceed to §D until step C.2 is complete.**

---

## §D · Tasks

> Per spec §17, tests come before implementation. Each Task uses TDD: Red (failing test) → Green (minimal impl) → Refactor → Commit.

### Task 1 — Schema migration 0004 (tracking + customer_user_id)

**Files:**
- Create: `supabase/migrations/0004_add_tracking_and_customer_user.sql`
- Modify: `src/lib/supabase/types.ts`

- [ ] **Step 1.1: Write the migration SQL**

  ```sql
  -- supabase/migrations/0004_add_tracking_and_customer_user.sql
  -- 2026-04-25 sprint-1: tracking columns + customer ownership FK.
  -- Reversible: down() drops the new columns and the FK.

  alter table public.orders
    add column if not exists tracking_number text,
    add column if not exists tracking_carrier text
      check (tracking_carrier is null
             or tracking_carrier in ('USPS','UPS','FedEx','DHL')),
    add column if not exists shipped_at timestamptz,
    add column if not exists customer_user_id uuid
      references auth.users(id) on delete set null;

  -- Index for the portal query: list orders by customer
  create index if not exists orders_customer_user_id_idx
    on public.orders (customer_user_id, created_at desc)
    where customer_user_id is not null;

  -- Email-based claim lookup is case-insensitive
  create index if not exists orders_customer_email_lower_idx
    on public.orders (lower(customer->>'email'));

  -- Status transition guard: shipped requires tracking_number not null.
  -- Belt-and-suspenders alongside the server action's runtime check.
  alter table public.orders
    drop constraint if exists orders_shipped_requires_tracking;
  alter table public.orders
    add constraint orders_shipped_requires_tracking
    check (status <> 'shipped' or tracking_number is not null);
  ```

- [ ] **Step 1.2: Apply migration via Supabase MCP (`apply_migration`) and confirm**

  Use the `mcp__949af78b-...__apply_migration` tool with `name: "0004_add_tracking_and_customer_user"` and the SQL from step 1.1.

  After apply, verify with `mcp__949af78b-...__list_tables` — `orders` should show the four new columns.

- [ ] **Step 1.3: Update `OrderRow` type**

  Edit `src/lib/supabase/types.ts`. Add to the `OrderRow` interface (after `status`):

  ```ts
  tracking_number?: string | null;
  tracking_carrier?: 'USPS' | 'UPS' | 'FedEx' | 'DHL' | null;
  shipped_at?: string | null;
  customer_user_id?: string | null;
  ```

- [ ] **Step 1.4: Run typecheck**

  ```bash
  npx tsc --noEmit
  ```

  Expected: zero errors.

- [ ] **Step 1.5: Commit**

  ```bash
  git add supabase/migrations/0004_add_tracking_and_customer_user.sql src/lib/supabase/types.ts
  git commit -m "feat(db): add tracking columns + customer_user_id FK on orders"
  ```

---

### Task 2 — Migration 0005 (RLS read-own-orders policy)

**Files:**
- Create: `supabase/migrations/0005_orders_rls_customer_read.sql`
- Create: `src/app/api/auth/__tests__/rls.test.ts` (integration test against local Supabase)

- [ ] **Step 2.1: Write the RLS migration**

  ```sql
  -- supabase/migrations/0005_orders_rls_customer_read.sql
  -- 2026-04-25 sprint-1: customers can SELECT their own orders.
  -- ruo_acknowledgments remains service-role-only (no policy added).

  -- Customers read only their own rows
  drop policy if exists "customers_read_own_orders" on public.orders;
  create policy "customers_read_own_orders"
    on public.orders
    for select
    to authenticated
    using (customer_user_id = auth.uid());

  -- Customers cannot UPDATE or DELETE — admin/service-role only.
  -- (Absence of policies for UPDATE/DELETE means deny-by-default for `authenticated`.)
  ```

- [ ] **Step 2.2: Apply via Supabase MCP, name `0005_orders_rls_customer_read`**

- [ ] **Step 2.3: Write the adversarial RLS integration test**

  Create `src/app/api/auth/__tests__/rls.test.ts`. Use the anon key + service-role key. Test cases per A.2 (I-RLS-1 through I-RLS-5). Test plan (skeleton):

  ```ts
  import { describe, it, expect, beforeAll, afterAll } from "vitest";
  import { createClient } from "@supabase/supabase-js";

  // Skip when env not configured (CI without Supabase) — tests opt in
  const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const RUN = !!(URL && ANON && SERVICE);
  const d = RUN ? describe : describe.skip;

  d("RLS: orders.customers_read_own_orders", () => {
    let serviceClient: ReturnType<typeof createClient>;
    let userA_id: string;
    let userB_id: string;
    let orderA_id: string;
    let orderB_id: string;

    beforeAll(async () => {
      serviceClient = createClient(URL!, SERVICE!);
      // Create two test auth.users via admin API; insert one order per user.
      // (See test fixture util in src/test-utils/rls-fixture.ts — to be created.)
    });

    afterAll(async () => {
      // Cleanup: delete test orders + delete test users.
    });

    it("anon client cannot read any order", async () => {
      const anon = createClient(URL!, ANON!);
      const { data, error } = await anon.from("orders").select("*").eq("order_id", orderA_id);
      expect(error).toBeNull();
      expect(data).toEqual([]); // RLS makes the row invisible, not 401
    });

    it("user A authenticated can read their own order", async () => {
      const userClient = createClient(URL!, ANON!);
      // sign-in user A via admin-issued one-time token, set session
      const { data, error } = await userClient.from("orders").select("*").eq("order_id", orderA_id);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it("user A cannot read user B's order", async () => {
      // ... auth as A, query B's order_id
      const { data } = await userClientA.from("orders").select("*").eq("order_id", orderB_id);
      expect(data).toEqual([]);
    });

    it("authenticated user cannot UPDATE their own order", async () => {
      const { error } = await userClientA.from("orders").update({ status: "shipped" }).eq("order_id", orderA_id);
      expect(error).not.toBeNull();
    });

    it("ruo_acknowledgments is invisible to authenticated users (no policy)", async () => {
      const { data } = await userClientA.from("ruo_acknowledgments").select("*");
      expect(data).toEqual([]);
    });
  });
  ```

  Build out the fixture helper `src/test-utils/rls-fixture.ts` with:
  - `createTestUser(email): Promise<{id, accessToken}>` using service-role admin API
  - `insertTestOrder(customer_user_id, email): Promise<{order_id}>`
  - `cleanup(userIds[], orderIds[])`

- [ ] **Step 2.4: Run RLS tests — they should PASS (red would mean RLS broken)**

  ```bash
  npm test -- rls.test.ts
  ```

- [ ] **Step 2.5: Commit**

  ```bash
  git add supabase/migrations/0005_orders_rls_customer_read.sql \
          src/app/api/auth/__tests__/rls.test.ts \
          src/test-utils/rls-fixture.ts
  git commit -m "feat(db): RLS policy — customers read their own orders + adversarial tests"
  ```

---

### Task 3 — Email templates (3 new)

**Files:**
- Modify: `src/lib/email/templates.ts`
- Modify: `src/lib/email/__tests__/templates.test.ts`

#### Task 3a — `paymentConfirmedEmail`

- [ ] **Step 3a.1: Write the failing tests (U-EMAIL-PC-1..4)**

  Append to `src/lib/email/__tests__/templates.test.ts`:

  ```ts
  describe("paymentConfirmedEmail", () => {
    it("subject is 'Payment received — your order is being prepared · BGP-<first8>'", () => {
      const email = paymentConfirmedEmail({ ...baseCtx, payment_method: "wire" });
      expect(email.subject).toBe(
        "Payment received — your order is being prepared · BGP-abc12345"
      );
    });

    it("body re-renders the full item list and final total", () => {
      const email = paymentConfirmedEmail({ ...baseCtx, payment_method: "wire" });
      expect(email.text).toContain("BPC-157");
      expect(email.text).toContain("$275"); // formatted from cents
      expect(email.html).toContain("BPC-157");
    });

    it("body includes the RUO disclaimer", () => {
      const email = paymentConfirmedEmail({ ...baseCtx, payment_method: "wire" });
      expect(email.text).toMatch(/research use only|laboratory research/i);
      expect(email.html).toMatch(/research use only|laboratory research/i);
    });

    it("escapes customer name in html and text", () => {
      const email = paymentConfirmedEmail({
        ...baseCtx,
        customer: { ...baseCtx.customer, name: '<img src=x onerror=alert(1)>' },
        payment_method: "wire",
      });
      expect(email.html).not.toContain("<img");
      expect(email.html).toContain("&lt;img");
    });
  });
  ```

- [ ] **Step 3a.2: Run — should FAIL (function not exported)**

  ```bash
  npm test -- templates.test.ts -t "paymentConfirmedEmail"
  ```

- [ ] **Step 3a.3: Implement `paymentConfirmedEmail` in `templates.ts`**

  Append after `adminOrderNotification`:

  ```ts
  export function paymentConfirmedEmail(ctx: OrderContext): {
    subject: string;
    text: string;
    html: string;
  } {
    const memo = `BGP-${ctx.order_id.slice(0, 8)}`;
    const customerName = escapeHtml(ctx.customer.name);
    const subject = `Payment received — your order is being prepared · ${memo}`;
    const itemsText = ctx.items.map(lineText).join("\n");
    const itemsHtml = ctx.items
      .map((i) => `<tr><td>${escapeHtml(i.name)} · ${escapeHtml(packLabel(i))} × ${i.quantity}</td><td style="text-align:right;font-family:monospace;">${formatPrice(i.unit_price * i.quantity * 100)}</td></tr>`)
      .join("\n");
    const total = formatPrice(ctx.subtotal_cents);
    const text = [
      `${customerName} —`,
      ``,
      `Your payment has been received. Your stack moves into our packing queue and ships within 1–2 business days. We'll send a tracking number when your box leaves our lab.`,
      ``,
      `Order ${memo}`,
      `--`,
      itemsText,
      `Total: ${total}`,
      ``,
      `For laboratory research use only. Not for human or veterinary use.`,
      ``,
      `Bench Grade Peptides · Made in USA`,
    ].join("\n");
    const html = editorialEmailHtml({
      title: "Your payment has been received.",
      bodyHtml: `<p>${customerName} —</p><p>Your payment has been received. Your stack moves into our packing queue and ships within 1–2 business days. We'll send a tracking number when your box leaves our lab.</p><table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px;">${itemsHtml}<tr style="border-top:2px solid #111;"><td style="padding-top:8px;">Total</td><td style="text-align:right;font-family:monospace;font-weight:700;padding-top:8px;">${total}</td></tr></table>`,
      memo,
    });
    return { subject, text, html };
  }
  ```

  Add an `editorialEmailHtml(opts: { title; bodyHtml; memo }): string` helper if not present — it returns the standard Editorial-direction wrapper (cream paper, serif heading, RUO footer). Reuse the styles from §9 of the spec. Place this helper at the top of `templates.ts` so both new and existing emails can call it.

- [ ] **Step 3a.4: Run tests — should PASS**

- [ ] **Step 3a.5: Commit**

  ```bash
  git add src/lib/email/templates.ts src/lib/email/__tests__/templates.test.ts
  git commit -m "feat(email): paymentConfirmedEmail template"
  ```

#### Task 3b — `orderShippedEmail`

- [ ] **Step 3b.1: Write tests (U-EMAIL-SH-1..5)**

  ```ts
  describe("orderShippedEmail", () => {
    const shippedCtx = {
      ...baseCtx,
      payment_method: "wire" as const,
      tracking_number: "9400111202509999999999",
      tracking_carrier: "USPS" as const,
      tracking_url: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111202509999999999",
      coa_lot_urls: [
        { sku: "BGP-BPC157-10-5", lot: "L-2026-0431", url: "https://benchgradepeptides.com/coa/L-2026-0431" },
      ],
    };

    it("subject is 'Shipped — tracking inside · BGP-<first8>'", () => {
      const email = orderShippedEmail(shippedCtx);
      expect(email.subject).toBe("Shipped — tracking inside · BGP-abc12345");
    });

    it("body includes tracking number, carrier, and URL", () => {
      const email = orderShippedEmail(shippedCtx);
      expect(email.text).toContain("9400111202509999999999");
      expect(email.text).toContain("USPS");
      expect(email.text).toContain("https://tools.usps.com/go/");
      expect(email.html).toContain("9400111202509999999999");
    });

    it("body includes the storage-and-handling panel", () => {
      const email = orderShippedEmail(shippedCtx);
      expect(email.text).toMatch(/2[–-]?8°C/);
      expect(email.text).toMatch(/light[- ]protect/i);
      expect(email.text).toMatch(/reconstituted/i);
    });

    it("renders per-lot COA URLs when provided", () => {
      const email = orderShippedEmail(shippedCtx);
      expect(email.text).toContain("L-2026-0431");
      expect(email.text).toContain("benchgradepeptides.com/coa/L-2026-0431");
    });

    it("falls back to portal link when coa_lot_urls is empty", () => {
      const email = orderShippedEmail({ ...shippedCtx, coa_lot_urls: [] });
      expect(email.text).toMatch(/COA available in your portal|sign in to view/i);
    });
  });
  ```

- [ ] **Step 3b.2..5: implement, test green, commit** — same TDD loop as 3a.

  ```ts
  export interface ShippedContext extends OrderContext {
    tracking_number: string;
    tracking_carrier: 'USPS' | 'UPS' | 'FedEx' | 'DHL';
    tracking_url: string;
    coa_lot_urls: Array<{ sku: string; lot: string; url: string }>;
  }

  export function orderShippedEmail(ctx: ShippedContext): { subject; text; html };
  ```

  Storage-and-handling panel content (verbatim, both text and html versions):

  ```
  Storage & handling
  ------------------
  Lyophilized vials: 2–8°C refrigerated (or –20°C for 6+ months).
  Light-protect; do not freeze-thaw repeatedly.
  Reconstitute only when ready to use; per-peptide reconstituted shelf
  life on the COA enclosed.
  ```

  Commit: `feat(email): orderShippedEmail with tracking + storage panel`

#### Task 3c — `accountClaimEmail`

- [ ] **Step 3c.1: Write tests (U-EMAIL-CL-1..3)**

  ```ts
  describe("accountClaimEmail", () => {
    const claimCtx = {
      ...baseCtx,
      payment_method: "wire" as const,
      magic_link_url: "https://benchgradepeptides.com/auth/callback?token=abc123",
    };

    it("subject is 'Claim your Bench Grade portal — order BGP-<first8>'", () => {
      const email = accountClaimEmail(claimCtx);
      expect(email.subject).toBe("Claim your Bench Grade portal — order BGP-abc12345");
    });

    it("body includes the supplied magic link URL", () => {
      const email = accountClaimEmail(claimCtx);
      expect(email.text).toContain("https://benchgradepeptides.com/auth/callback?token=abc123");
      expect(email.html).toContain("https://benchgradepeptides.com/auth/callback?token=abc123");
    });

    it("explains 'click any future magic link from us — same account'", () => {
      const email = accountClaimEmail(claimCtx);
      expect(email.text.toLowerCase()).toMatch(/same account|future magic link/);
    });
  });
  ```

- [ ] **Step 3c.2..5: TDD loop**

  ```ts
  export interface ClaimContext extends OrderContext {
    magic_link_url: string;
  }
  export function accountClaimEmail(ctx: ClaimContext): { subject; text; html };
  ```

  Commit: `feat(email): accountClaimEmail`

---

### Task 4 — Email dispatch helper + wire into webhook + admin actions

**Files:**
- Create: `src/lib/email/notifications/send-order-emails.ts`
- Modify: `src/app/api/webhook/nowpayments/route.ts`
- Modify: `src/app/actions/admin.ts`

- [ ] **Step 4.1: Write integration tests for `send-order-emails`**

  Create `src/lib/email/notifications/__tests__/send-order-emails.test.ts`. Mock `getResend()`. Cases:
  - `sendPaymentConfirmed(orderRow)` calls Resend with the right `to`, subject, and html
  - When Resend returns failure, returns `{ ok: false }` but does NOT throw
  - When `getResend()` returns null (env not set), returns `{ ok: false, reason: 'resend-unconfigured' }` and logs

- [ ] **Step 4.2: Implement the helper**

  ```ts
  // src/lib/email/notifications/send-order-emails.ts
  import { getResend, EMAIL_FROM, ADMIN_NOTIFICATION_EMAIL } from "@/lib/email/client";
  import {
    paymentConfirmedEmail,
    orderShippedEmail,
    accountClaimEmail,
    type ShippedContext,
    type ClaimContext,
  } from "@/lib/email/templates";
  import type { OrderRow } from "@/lib/supabase/types";

  function rowToOrderContext(row: OrderRow): {
    order_id: string;
    customer: OrderRow["customer"];
    items: OrderRow["items"];
    subtotal_cents: number;
    payment_method: NonNullable<OrderRow["payment_method"]>;
  } {
    return {
      order_id: row.order_id,
      customer: row.customer,
      items: row.items.map((i) => ({ ...i, pack_size: 1 /* legacy compat */ })) as never,
      subtotal_cents: row.subtotal_cents,
      payment_method: row.payment_method ?? "wire",
    };
  }

  export async function sendPaymentConfirmed(row: OrderRow): Promise<{ ok: boolean }> {
    const resend = getResend();
    if (!resend) return { ok: false };
    const e = paymentConfirmedEmail(rowToOrderContext(row));
    try {
      await resend.emails.send({ from: EMAIL_FROM, to: row.customer.email, ...e });
      return { ok: true };
    } catch (err) {
      console.error("[sendPaymentConfirmed] failed:", err);
      return { ok: false };
    }
  }

  export async function sendOrderShipped(row: OrderRow, coaLotUrls: ShippedContext["coa_lot_urls"]): Promise<{ ok: boolean }>;
  export async function sendAccountClaim(row: OrderRow, magicLinkUrl: string): Promise<{ ok: boolean }>;
  ```

- [ ] **Step 4.3: Wire `sendPaymentConfirmed` into the NowPayments webhook**

  In `src/app/api/webhook/nowpayments/route.ts`, after the successful UPDATE that flips status to `funded`, immediately fire `sendPaymentConfirmed(row)`. Crucial behaviours:
  - Email dispatch is fire-and-forget at the webhook return level (must not block 200 response or cause retries)
  - Use the rowcount from the UPDATE to detect "actually transitioned" vs "no-op duplicate IPN" — only send email when rowcount > 0

  ```ts
  // After: const { error: updateErr, count } = await supa.from('orders').update({...}).eq('order_id', orderId).in('status', allowedSources).select('*', { count: 'exact', head: false });
  if (newStatus === 'funded' && count && count > 0) {
    // Re-read the row to pass to email helper (UPDATE returned rows in the select)
    const updatedRow = data?.[0];
    if (updatedRow) {
      await sendPaymentConfirmed(updatedRow as OrderRow);
    }
  }
  ```

- [ ] **Step 4.4: Add `markOrderFunded` server action**

  ```ts
  // src/app/actions/admin.ts (append)
  export async function markOrderFunded(orderId: string): Promise<{ ok: boolean; error?: string }> {
    if (!(await isAdmin())) return { ok: false, error: "Unauthorized." };
    if (!isValidUuid(orderId)) return { ok: false, error: "Invalid order id." };
    const supa = getSupabaseServer();
    if (!supa) return { ok: false, error: "Database unavailable." };
    // Atomic transition: only flip if currently awaiting_payment (or legacy awaiting_wire)
    const { data, error } = await supa
      .from("orders")
      .update({ status: "funded" })
      .eq("order_id", orderId)
      .in("status", ["awaiting_payment", "awaiting_wire"])
      .select("*");
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) {
      return { ok: false, error: "Order not in a fundable state." };
    }
    await sendPaymentConfirmed(data[0] as OrderRow);
    return { ok: true };
  }
  ```

- [ ] **Step 4.5: Add `markOrderShipped` server action**

  Same pattern:
  - Validate orderId, validate `tracking_number` (1..120 chars, simple regex `^[A-Z0-9-]+$`), validate `carrier` enum
  - Atomic transition: only `funded` → `shipped`; UPDATE sets `tracking_number`, `tracking_carrier`, `shipped_at = now()`, `status = 'shipped'`
  - Refuse if rowcount = 0
  - Fire `sendOrderShipped(row, coa_lot_urls)` — `coa_lot_urls` come from a stub function `lookupCoaUrls(items)` that returns empty array for now (per spec §16.3 — placeholder vials in v1; COA wiring lands when a COA storage backend is built; the email already falls back to portal link)

- [ ] **Step 4.6: Run integration tests (with Supabase configured) — should PASS**

- [ ] **Step 4.7: Commit**

  ```bash
  git add src/lib/email/notifications/ src/app/actions/admin.ts src/app/api/webhook/nowpayments/route.ts
  git commit -m "feat(email): wire payment-confirmed + shipped emails to status transitions"
  ```

---

### Task 5 — Stack & Save discount engine (pure functions)

**Files:**
- Create: `src/lib/cart/discounts.ts`
- Create: `src/lib/cart/__tests__/discounts.test.ts`

- [ ] **Step 5.1: Write all U-DISC-1..13, U-MULT-1..5, U-COMBO-1..3 tests**

  ```ts
  // src/lib/cart/__tests__/discounts.test.ts
  import { describe, it, expect } from "vitest";
  import {
    computeStackSaveDiscount,
    nextStackSaveTier,
    computeSameSkuMultiplier,
    computeCartTotals,
  } from "../discounts";
  import type { CartItem } from "../types";

  function vial(sku: string, price: number, qty: number = 1): CartItem {
    return {
      sku, product_slug: 'p', category_slug: 'c', name: sku,
      size_mg: 10, pack_size: 1, unit_price: price, quantity: qty,
      vial_image: '',
    };
  }

  describe('computeStackSaveDiscount', () => {
    it('U-DISC-1: 0 vials → no tier, no free shipping', () => {
      expect(computeStackSaveDiscount([])).toEqual({
        tier_percent: 0, free_shipping: false, free_vial_size_mg: null, vial_count: 0
      });
    });
    it('U-DISC-2: 1 vial → no tier, paid shipping', () => {
      expect(computeStackSaveDiscount([vial('A',100)])).toEqual({
        tier_percent: 0, free_shipping: false, free_vial_size_mg: null, vial_count: 1
      });
    });
    it('U-DISC-3: 2 vials → free shipping, no tier %', () => {
      expect(computeStackSaveDiscount([vial('A',100,2)])).toEqual({
        tier_percent: 0, free_shipping: true, free_vial_size_mg: null, vial_count: 2
      });
    });
    it('U-DISC-4: 3 vials → 15% off + free ship', () => {
      const r = computeStackSaveDiscount([vial('A',100,3)]);
      expect(r.tier_percent).toBe(15);
      expect(r.free_shipping).toBe(true);
    });
    it('U-DISC-5: 4 vials still 15%', () => {
      expect(computeStackSaveDiscount([vial('A',100,4)]).tier_percent).toBe(15);
    });
    it('U-DISC-6: 5 vials → 20%', () => {
      expect(computeStackSaveDiscount([vial('A',100,5)]).tier_percent).toBe(20);
    });
    it('U-DISC-8: 8 vials → 25% + free 5mg vial', () => {
      const r = computeStackSaveDiscount([vial('A',100,8)]);
      expect(r.tier_percent).toBe(25);
      expect(r.free_vial_size_mg).toBe(5);
    });
    it('U-DISC-9: 12 vials → 28% + free 10mg vial', () => {
      const r = computeStackSaveDiscount([vial('A',100,12)]);
      expect(r.tier_percent).toBe(28);
      expect(r.free_vial_size_mg).toBe(10);
    });
    it('U-DISC-10: 20 vials cap at 28%', () => {
      expect(computeStackSaveDiscount([vial('A',100,20)]).tier_percent).toBe(28);
    });
  });

  describe('nextStackSaveTier', () => {
    it('U-DISC-11: at 1 vial, target=2', () => {
      expect(nextStackSaveTier(1)).toEqual({
        target: 2,
        message: 'Add 1 more vial — unlock free domestic shipping',
        progress_pct: 50,
      });
    });
    it('U-DISC-12: at 4 vials, target=5 (20% off)', () => {
      expect(nextStackSaveTier(4)?.target).toBe(5);
      expect(nextStackSaveTier(4)?.message).toMatch(/20%/);
    });
    it('U-DISC-13: at 12+ vials returns null', () => {
      expect(nextStackSaveTier(12)).toBeNull();
      expect(nextStackSaveTier(50)).toBeNull();
    });
  });

  describe('computeSameSkuMultiplier', () => {
    it('U-MULT-1: all distinct → 0%', () => {
      expect(computeSameSkuMultiplier([vial('A',100), vial('B',100), vial('C',100)])).toBe(0);
    });
    it('U-MULT-2: 4 of same → 0%', () => {
      expect(computeSameSkuMultiplier([vial('A',100,4)])).toBe(0);
    });
    it('U-MULT-3: 5 of same → 5%', () => {
      expect(computeSameSkuMultiplier([vial('A',100,5)])).toBe(5);
    });
    it('U-MULT-4: 5 of one + 3 of another → 5%', () => {
      expect(computeSameSkuMultiplier([vial('A',100,5), vial('B',100,3)])).toBe(5);
    });
    it('U-MULT-5: 5 of one + 5 of another still 5% (capped)', () => {
      expect(computeSameSkuMultiplier([vial('A',100,5), vial('B',100,5)])).toBe(5);
    });
  });

  describe('computeCartTotals', () => {
    it('U-COMBO-1: 5 of same SKU at $100 → subtotal 500, Stack&Save 20%, SameSKU 5%', () => {
      const t = computeCartTotals([vial('A',100,5)]);
      expect(t.subtotal_cents).toBe(50000);
      // 20% then 5% multiplicative? OR additive 25%? — Documented ORDER OF OPS:
      // first Stack&Save tier off subtotal, then SameSKU on the post-tier total.
      expect(t.stack_save_discount_cents).toBe(10000); // 20% of 50000
      expect(t.same_sku_discount_cents).toBe(2000);    // 5% of (50000-10000)
      expect(t.total_cents).toBe(50000 - 10000 - 2000);
      expect(t.free_shipping).toBe(true);
    });

    it('U-COMBO-2: 8 vials, 5 same SKU + 3 distinct → 25% Stack + 5% SameSKU + free 5mg vial', () => {
      const items = [vial('A',100,5), vial('B',150,1), vial('C',200,1), vial('D',250,1)];
      const t = computeCartTotals(items);
      expect(t.subtotal_cents).toBe(50000 + 15000 + 20000 + 25000); // 110000
      expect(t.stack_save_tier_percent).toBe(25);
      expect(t.same_sku_discount_cents).toBeGreaterThan(0);
      expect(t.free_vial_entitlement).toEqual({ size_mg: 5 });
    });

    it('U-COMBO-3: rounding consistency — sum of per-line allocated discounts equals reported totals', () => {
      const t = computeCartTotals([vial('A',99,3)]);
      // Three $99 vials = $297 subtotal → 15% Stack&Save → $44.55 in cents = 4455
      // Cents math must be deterministic and not lose money.
      const expectedStack = Math.round(29700 * 0.15); // 4455
      expect(t.stack_save_discount_cents).toBe(expectedStack);
    });
  });
  ```

- [ ] **Step 5.2: Run — all should FAIL (functions not exported)**

- [ ] **Step 5.3: Implement `discounts.ts`**

  ```ts
  // src/lib/cart/discounts.ts
  import type { CartItem } from "./types";

  export interface StackSaveResult {
    tier_percent: 0 | 15 | 20 | 25 | 28;
    free_shipping: boolean;
    free_vial_size_mg: 5 | 10 | null;
    vial_count: number;
  }

  export interface NextTierInfo {
    target: number;
    message: string;
    progress_pct: number;
  }

  export interface CartTotals {
    subtotal_cents: number;
    vial_count: number;
    stack_save_tier_percent: number;
    stack_save_discount_cents: number;
    same_sku_multiplier_percent: 0 | 5;
    same_sku_discount_cents: number;
    free_shipping: boolean;
    free_vial_entitlement: { size_mg: 5 | 10 } | null;
    total_cents: number;
  }

  function vialCount(items: CartItem[]): number {
    return items.reduce((n, i) => n + i.quantity * i.pack_size, 0);
  }

  export function computeStackSaveDiscount(items: CartItem[]): StackSaveResult {
    const vc = vialCount(items);
    if (vc >= 12) return { tier_percent: 28, free_shipping: true, free_vial_size_mg: 10, vial_count: vc };
    if (vc >= 8)  return { tier_percent: 25, free_shipping: true, free_vial_size_mg: 5, vial_count: vc };
    if (vc >= 5)  return { tier_percent: 20, free_shipping: true, free_vial_size_mg: null, vial_count: vc };
    if (vc >= 3)  return { tier_percent: 15, free_shipping: true, free_vial_size_mg: null, vial_count: vc };
    if (vc >= 2)  return { tier_percent: 0,  free_shipping: true, free_vial_size_mg: null, vial_count: vc };
    return { tier_percent: 0, free_shipping: false, free_vial_size_mg: null, vial_count: vc };
  }

  export function nextStackSaveTier(vials: number): NextTierInfo | null {
    const tiers: Array<{ at: number; msg: string }> = [
      { at: 2,  msg: 'Add %d more vial%s — unlock free domestic shipping' },
      { at: 3,  msg: 'Add %d more vial%s — unlock 15%% off the order' },
      { at: 5,  msg: 'Add %d more vial%s — unlock 20%% off the order' },
      { at: 8,  msg: 'Add %d more vial%s — unlock 25%% off + a free 5mg vial of choice' },
      { at: 12, msg: 'Add %d more vial%s — unlock 28%% off + a free 10mg vial of choice' },
    ];
    for (const tier of tiers) {
      if (vials < tier.at) {
        const need = tier.at - vials;
        return {
          target: tier.at,
          message: tier.msg.replace('%d', String(need)).replace('%s', need === 1 ? '' : 's'),
          progress_pct: Math.round((vials / tier.at) * 100),
        };
      }
    }
    return null;
  }

  export function computeSameSkuMultiplier(items: CartItem[]): 0 | 5 {
    const counts = new Map<string, number>();
    for (const i of items) {
      counts.set(i.sku, (counts.get(i.sku) ?? 0) + i.quantity * i.pack_size);
    }
    for (const c of counts.values()) {
      if (c >= 5) return 5;
    }
    return 0;
  }

  export function computeCartTotals(items: CartItem[]): CartTotals {
    const subtotal_cents = Math.round(items.reduce((s, i) => s + i.unit_price * i.quantity * 100, 0));
    const ss = computeStackSaveDiscount(items);
    const stack_save_discount_cents = Math.round(subtotal_cents * (ss.tier_percent / 100));
    const post_stack = subtotal_cents - stack_save_discount_cents;
    const sameSku = computeSameSkuMultiplier(items);
    const same_sku_discount_cents = Math.round(post_stack * (sameSku / 100));
    return {
      subtotal_cents,
      vial_count: ss.vial_count,
      stack_save_tier_percent: ss.tier_percent,
      stack_save_discount_cents,
      same_sku_multiplier_percent: sameSku,
      same_sku_discount_cents,
      free_shipping: ss.free_shipping,
      free_vial_entitlement: ss.free_vial_size_mg ? { size_mg: ss.free_vial_size_mg } : null,
      total_cents: post_stack - same_sku_discount_cents,
    };
  }
  ```

- [ ] **Step 5.4: Run tests — all PASS**

- [ ] **Step 5.5: Commit**

  ```bash
  git add src/lib/cart/discounts.ts src/lib/cart/__tests__/discounts.test.ts
  git commit -m "feat(cart): Stack & Save + Same-SKU discount engine (pure functions)"
  ```

---

### Task 6 — Cart UI integration (drawer + checkout summary)

**Files:**
- Create: `src/components/cart/StackSaveProgress.tsx`
- Modify: `src/components/cart/CartDrawer.tsx`
- Modify: `src/lib/cart/CartContext.tsx`, `src/lib/cart/types.ts`
- Modify: `src/app/checkout/CheckoutPageClient.tsx`

- [ ] **Step 6.1: Expose totals via `CartApi`**

  In `src/lib/cart/types.ts`, add to `CartApi`:

  ```ts
  totals: import('./discounts').CartTotals;
  nextTier: import('./discounts').NextTierInfo | null;
  ```

  In `CartContext.tsx`, compute via `useMemo`:

  ```ts
  const totals = useMemo(() => computeCartTotals(items), [items]);
  const nextTier = useMemo(() => nextStackSaveTier(totals.vial_count), [totals.vial_count]);
  ```

- [ ] **Step 6.2: Build `StackSaveProgress.tsx`**

  ```tsx
  'use client';
  import { useCart } from '@/lib/cart/CartContext';
  import { formatPrice } from '@/lib/utils';

  export function StackSaveProgress() {
    const { totals, nextTier } = useCart();
    if (totals.vial_count === 0) return null;
    const tierLabel = totals.stack_save_tier_percent > 0
      ? `${totals.stack_save_tier_percent}% off unlocked`
      : (totals.free_shipping ? 'Free shipping unlocked' : null);
    return (
      <div className="space-y-2">
        {tierLabel && (
          <div className="text-xs text-oxblood font-mono uppercase tracking-wider">
            ✓ {tierLabel}
          </div>
        )}
        {nextTier && (
          <>
            <div className="text-xs text-ink-soft">
              {nextTier.message}
            </div>
            <div className="h-1 bg-paper-soft border rule overflow-hidden">
              <div
                className="h-full bg-oxblood transition-all duration-300"
                style={{ width: `${nextTier.progress_pct}%` }}
                role="progressbar"
                aria-valuenow={nextTier.progress_pct}
                aria-valuemin={0}
                aria-valuemax={100}
              />
            </div>
          </>
        )}
      </div>
    );
  }
  ```

- [ ] **Step 6.3: Render in CartDrawer**

  In `src/components/cart/CartDrawer.tsx`, insert `<StackSaveProgress />` above the Subtotal block. Render the new discount lines:

  - "Stack & Save · X% off" line if `totals.stack_save_discount_cents > 0`
  - "Same-SKU Bonus · 5% off" line if `totals.same_sku_discount_cents > 0`
  - "Free domestic shipping" line if `totals.free_shipping`
  - Update the Subtotal display to show the original subtotal struck-through and the post-discount Total in oxblood

  All discount lines styled in oxblood text. Final Total uses font-mono-data, larger size.

- [ ] **Step 6.4: Component tests for cart drawer (C-CART-1..4)**

  Create `src/components/cart/__tests__/CartDrawer.test.tsx` (vitest with happy-dom). Render `<CartProvider>` with seeded items, snapshot key text + progress bar widths.

- [ ] **Step 6.5: Mirror the discount lines in CheckoutPageClient summary**

  In `src/app/checkout/CheckoutPageClient.tsx`, in the order summary aside, insert the same discount line-items below the existing `<ul>` of items but above the existing subtotal/itemCount block. Pull from `totals` instead of computing locally.

- [ ] **Step 6.6: Run tests + manual smoke via Claude Preview**

  Run preview, add 2/3/5/8 vials in turn, screenshot the cart drawer for each.

- [ ] **Step 6.7: Commit**

  ```bash
  git add src/lib/cart/ src/components/cart/ src/app/checkout/CheckoutPageClient.tsx
  git commit -m "feat(cart): Stack & Save UI — live progress, discount lines, checkout mirror"
  ```

---

### Task 7 — Server-side discount enforcement

**Files:**
- Modify: `src/app/actions/orders.ts`

- [ ] **Step 7.1: Write integration test (I-SUBMIT-1)**

  In `src/app/actions/__tests__/orders.test.ts` (new), with Supabase mocked or service-role local:
  - Submit cart with 3 vials of one SKU → server-computed total = subtotal × 0.85, recorded to `subtotal_cents` field
  - Submit a forged input that includes a `discount_cents` or `total_cents` field → those fields are ignored (shape-validated by Zod, ignored fields stripped)

- [ ] **Step 7.2: Modify `submitOrder`**

  In `src/app/actions/orders.ts`, after `resolveCartOnServer` returns, replace the existing `subtotal_cents` write with the post-discount total:

  ```ts
  import { computeCartTotals } from "@/lib/cart/discounts";
  // ... after `resolved`:
  const totals = computeCartTotals(resolved.items);
  // Replace: subtotal_cents: resolved.subtotal_cents,
  // With:
  const row = {
    // ...
    subtotal_cents: resolved.subtotal_cents,           // pre-discount, for analytics
    discount_cents: totals.subtotal_cents - totals.total_cents, // total reduction
    total_cents: totals.total_cents,                   // what the customer owes
    free_vial_entitlement: totals.free_vial_entitlement,
    // ...
  };
  ```

  Add an INTEGER column `discount_cents` and `total_cents` and JSONB `free_vial_entitlement` to `orders` via migration (extend Task 1's 0004 OR create `0006_add_totals.sql`). Update `OrderRow` type.

- [ ] **Step 7.3: Run tests + typecheck**

- [ ] **Step 7.4: Commit**

  ```bash
  git add supabase/migrations/0006_add_totals.sql src/app/actions/orders.ts src/lib/supabase/types.ts
  git commit -m "feat(orders): server-side discount computation + persistence"
  ```

---

### Task 8 — Magic-link auth (request + callback + middleware)

**Files:**
- Create: `src/app/actions/auth.ts`
- Create: `src/app/auth/callback/route.ts`
- Create: `src/app/login/page.tsx`, `src/app/login/LoginForm.tsx`
- Create: `src/middleware.ts`

- [ ] **Step 8.1: Read Next.js 16 docs for route handlers + middleware**

  ```bash
  cat node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md | head -200
  ```

  Confirm route handler signature, dynamic config, middleware matcher syntax.

- [ ] **Step 8.2: Write tests for `requestMagicLink` (U-AUTH-1..4)**

  `src/app/actions/__tests__/auth.test.ts` with mocked Supabase ssr client + rate-limit store.

- [ ] **Step 8.3: Implement `requestMagicLink`**

  ```ts
  // src/app/actions/auth.ts
  "use server";
  import { z } from "zod";
  import { headers } from "next/headers";
  import { createServerSupabase } from "@/lib/supabase/client";
  import { resolveClientIp } from "@/lib/ratelimit/ip";
  import { SupabaseRateLimitStore } from "@/lib/ratelimit/supabase-store";
  import { MemoryRateLimitStore } from "@/lib/ratelimit/memory-store";
  import { getSupabaseServer } from "@/lib/supabase/server";
  import { SITE_URL } from "@/lib/site";

  const EmailSchema = z.string().trim().email().max(200);
  const dev = new MemoryRateLimitStore();

  export async function requestMagicLink(formData: FormData): Promise<{ ok: boolean; error?: string }> {
    const raw = String(formData.get('email') ?? '');
    const parsed = EmailSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: 'Valid email required.' };
    const email = parsed.data.toLowerCase();

    const h = await headers();
    const ip = resolveClientIp(h, { isProduction: process.env.NODE_ENV === 'production' });
    if (!ip.ok) return { ok: false, error: ip.reason };

    const svc = getSupabaseServer();
    const store = svc ? new SupabaseRateLimitStore(svc) : dev;
    // 3 requests per 5 minutes per IP
    const allowed = await store.consume(`magic-link:${ip.ip}`, 3, 5 * 60_000);
    if (!allowed.allowed) return { ok: false, error: 'Too many requests. Try again in a few minutes.' };

    const supa = await createServerSupabase();
    const { error } = await supa.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${SITE_URL}/auth/callback` },
    });
    if (error) return { ok: false, error: 'Could not send link. Please try again.' };
    return { ok: true };
  }
  ```

- [ ] **Step 8.4: Implement the callback route**

  ```ts
  // src/app/auth/callback/route.ts
  import { NextResponse } from "next/server";
  import { createServerSupabase } from "@/lib/supabase/client";
  import { linkOrdersToUser } from "@/app/actions/account";

  export async function GET(req: Request) {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    if (!code) {
      return NextResponse.redirect(new URL('/login?error=missing-code', url));
    }
    const supa = await createServerSupabase();
    const { data, error } = await supa.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      return NextResponse.redirect(new URL('/login?error=invalid-link', url));
    }
    // Backfill any orders matching this email
    await linkOrdersToUser(data.session.user.id, data.session.user.email!);
    // Open-redirect guard: only honor `next` if it starts with `/` and not `//`
    const next = url.searchParams.get('next');
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/account';
    return NextResponse.redirect(new URL(safeNext, url));
  }
  ```

- [ ] **Step 8.5: Build `/login` page + form**

  Server component reads search params (error + redirect), passes to client form. Form uses `requestMagicLink` server action. After submit: success state shows "Check your inbox at <email>". Error state shows the error inline. UX-to-close: submit button has loading spinner replaced by progress check; success state has a calm confirming illustration of a sealed envelope (use Lucide `Mail` for v1).

- [ ] **Step 8.6: Implement `src/middleware.ts`**

  ```ts
  import { NextResponse, type NextRequest } from 'next/server';
  import { createServerClient, type CookieOptions } from '@supabase/ssr';

  export async function middleware(req: NextRequest) {
    const res = NextResponse.next({ request: { headers: req.headers } });
    if (!req.nextUrl.pathname.startsWith('/account')) return res;
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return res;

    const supa = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return req.cookies.getAll(); },
          setAll(arr) { arr.forEach(({ name, value, options }) => res.cookies.set(name, value, options as CookieOptions)); },
        },
      }
    );
    const { data } = await supa.auth.getUser();
    if (!data.user) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('next', req.nextUrl.pathname);
      return NextResponse.redirect(url);
    }
    return res;
  }

  export const config = { matcher: ['/account/:path*'] };
  ```

- [ ] **Step 8.7: Run all auth-related tests + typecheck + manual flow**

- [ ] **Step 8.8: Commit**

  ```bash
  git add src/app/actions/auth.ts src/app/auth/ src/app/login/ src/middleware.ts
  git commit -m "feat(auth): magic-link request, callback, /login, middleware gate"
  ```

---

### Task 9 — Account claim flow (auto-fire on first order)

**Files:**
- Create: `src/app/actions/account.ts`
- Modify: `src/app/actions/orders.ts`

- [ ] **Step 9.1: Tests for `linkOrdersToUser` (I-CLAIM-1..4)**

- [ ] **Step 9.2: Implement `linkOrdersToUser`**

  ```ts
  "use server";
  import { getSupabaseServer } from "@/lib/supabase/server";

  export async function linkOrdersToUser(userId: string, email: string): Promise<{ ok: boolean; linked: number }> {
    const supa = getSupabaseServer();
    if (!supa) return { ok: false, linked: 0 };
    const lower = email.trim().toLowerCase();
    // First-claim-wins: only update orders whose customer_user_id is currently null
    const { data, error } = await supa
      .from('orders')
      .update({ customer_user_id: userId })
      .filter('customer_user_id', 'is', null)
      .filter('customer->>email', 'ilike', lower)
      .select('order_id');
    if (error) {
      console.error('[linkOrdersToUser]', error);
      return { ok: false, linked: 0 };
    }
    return { ok: true, linked: data?.length ?? 0 };
  }
  ```

- [ ] **Step 9.3: Wire account-claim email into `submitOrder`**

  In `src/app/actions/orders.ts`, after the existing customer + admin emails fire, ALSO request a magic link for the customer email and dispatch `accountClaimEmail` with that link. Resilient to Resend failure (best-effort, log only).

  Use Supabase admin API to generate a one-time link (so we can include it in the email rather than relying on a separate signInWithOtp roundtrip):

  ```ts
  const svc = getSupabaseServer();
  if (svc) {
    const { data: linkData } = await svc.auth.admin.generateLink({
      type: 'magiclink',
      email: validInput.customer.email,
      options: { redirectTo: `${SITE_URL}/auth/callback?next=/account` },
    });
    if (linkData?.properties?.action_link) {
      const claim = accountClaimEmail({
        ...emailCtx,
        magic_link_url: linkData.properties.action_link,
      });
      try {
        await resend!.emails.send({ from: EMAIL_FROM, to: validInput.customer.email, ...claim });
      } catch (e) { console.error('[submitOrder] account claim email failed:', e); }
    }
  }
  ```

- [ ] **Step 9.4: Run tests + typecheck**

- [ ] **Step 9.5: Commit**

  ```bash
  git add src/app/actions/account.ts src/app/actions/orders.ts
  git commit -m "feat(auth): auto account-claim email + linkOrdersToUser on callback"
  ```

---

### Task 10 — Customer portal pages

**Files:**
- Modify: `src/app/account/page.tsx`
- Create: `src/app/account/layout.tsx`
- Create: `src/app/account/orders/page.tsx`, `src/app/account/orders/[id]/page.tsx`
- Create: `src/components/account/OrderStatusPill.tsx`, `OrderTimeline.tsx`, `AccountNav.tsx`

- [ ] **Step 10.1: `<OrderStatusPill>` — pure component with snapshot test**

  Renders one of: "Awaiting payment" (paper-soft bg), "Payment received" (oxblood), "Shipped" (teal), "Delivered" (ink), "Cancelled" / "Refunded" (muted).

- [ ] **Step 10.2: `<OrderTimeline>` — vertical timeline component**

  Props: `events: Array<{ status: OrderStatus; at: string | null }>`. Renders 4 rows with dots and timestamps.

- [ ] **Step 10.3: `<AccountNav>` with tabs**

  Tabs: Dashboard / Orders / Subscription (greyed in v1) / Messages (greyed in v1) / Referrals (greyed in v1) / Profile.

- [ ] **Step 10.4: `/account/layout.tsx` — auth gate + nav frame**

  Server component reads user via `createServerSupabase().auth.getUser()`, redirects to `/login` if null (belt with the middleware suspenders).

- [ ] **Step 10.5: `/account/page.tsx` — dashboard**

  Lists 3 most recent orders (with `<OrderStatusPill>`), placeholder cards for messaging + referrals, "browse the catalog" CTA.

- [ ] **Step 10.6: `/account/orders/page.tsx` — full list**

  Server component queries via the user's RLS-scoped client (NOT service role — RLS must be the gate). Pagination cursor by `created_at`.

- [ ] **Step 10.7: `/account/orders/[id]/page.tsx` — detail**

  Loads single order via RLS client; if not found → `notFound()` (which renders Next's not-found.tsx). Renders items, timeline, tracking link if present, COA link placeholder.

- [ ] **Step 10.8: Add `<HeaderAccountSlot>` to Header — "Sign in" or "Account"**

  Shows the user's first name initial in a circle when authed, with dropdown to /account or sign-out.

- [ ] **Step 10.9: Snapshot + smoke tests** (C-PORTAL-1..6 via Claude Preview)

- [ ] **Step 10.10: Commit**

  ```bash
  git add src/app/account/ src/components/account/ src/components/layout/Header.tsx
  git commit -m "feat(portal): /account dashboard + /orders + /orders/[id] + nav"
  ```

---

### Task 11 — `/why-no-cards` page + checkout footnote + email narrative line

**Files:**
- Create: `src/app/why-no-cards/page.tsx`
- Create: `src/components/checkout/CardProcessorFootnote.tsx`
- Modify: `src/app/checkout/CheckoutPageClient.tsx`
- Modify: `src/lib/email/templates.ts` (orderConfirmationEmail — append narrative line)

- [ ] **Step 11.1: Write the editorial copy**

  Draft in spec voice: ≤500 words, three sections — "Why we don't take cards yet", "What this protects", "Where we're going". Include external link to a credible article on RUO peptide processor scrutiny if helpful.

- [ ] **Step 11.2: Build the page** with Editorial direction tokens (cream paper, serif headline) — use existing tokens for now; rebrand swaps them later. Include OG metadata + canonical URL.

- [ ] **Step 11.3: `<CardProcessorFootnote>` component** — single-line italic gray text with link to `/why-no-cards`. Render directly under the payment selector in CheckoutPageClient.

- [ ] **Step 11.4: Append narrative line to confirmation email**

  In `orderConfirmationEmail` (existing), after the wire instructions block, append:

  > *"Why no cards? RUO peptides face heavy merchant scrutiny. We're building the reputation to unlock card processing — your order helps us get there."*

  Add a test: `orderConfirmationEmail` body contains "Why no cards?" exactly once.

- [ ] **Step 11.5: Tests + manual verify (C-CHECKOUT-2, C-PORTAL-7)**

- [ ] **Step 11.6: Commit**

  ```bash
  git add src/app/why-no-cards/ src/components/checkout/CardProcessorFootnote.tsx src/app/checkout/CheckoutPageClient.tsx src/lib/email/templates.ts src/lib/email/__tests__/templates.test.ts
  git commit -m "feat(narrative): /why-no-cards page + checkout footnote + email line"
  ```

---

## §E · UX-to-close commitments per surface

Per spec §16.4 — every surface must close the customer.

| Surface | Commitment | Verify |
|---|---|---|
| Cart drawer | Live tier-progress bar always visible above subtotal when items > 0 | Manual M-1 |
| Cart drawer | Tier-discount line appears in red below subtotal when active | C-CART-2 |
| Cart drawer | "Add N more vial(s) to unlock X" message updates instantly on +/- | C-CART-3 |
| Cart drawer | Free-vial-entitlement message appears at 8/12 vials with call-to-action wording | C-CART-4 |
| Checkout summary | Mirrors cart drawer totals exactly (single source of truth via `computeCartTotals`) | C-CHECKOUT-1 |
| Checkout payment selector | Card-processor footnote sits directly under the rails — single line, calm | C-CHECKOUT-2 |
| Checkout submit button | Trust strip + next-steps timeline already render (regression check) | C-CHECKOUT-3 |
| `/login` | Submit shows "Check your inbox" success state within 200ms; spinner is a content-shaped skeleton, never a full-screen overlay | M-3 |
| `/auth/callback` | Successful exchange redirects to `/account` (or `next=` if safe) — no white-screen flash | M-4 |
| `/account` dashboard | First-time visitor (no orders) gets a CTA card "Browse the catalog" rather than empty state — every empty state is a sales surface | manual |
| `/account/orders/[id]` | Status timeline reads top-to-bottom in the customer's reading direction; no "click to expand" friction | C-PORTAL-5 |
| Order-confirmation email | Single primary CTA (View order in portal); subject line concrete and order-id-tagged | regression |
| Payment-confirmed email | Reassurance opener ("Your stack moves into our packing queue"); one CTA | U-EMAIL-PC-* |
| Shipped email | Tracking number bolded; carrier-aware tracking URL; storage panel inline (not below the fold) | U-EMAIL-SH-* |
| Account-claim email | Magic-link CTA is the ONLY button; secondary text explains "any future link works" | U-EMAIL-CL-* |
| `/why-no-cards` | Single H1, structured headings, 500 words max, ends with clear "back to checkout" link | C-PORTAL-7 |

---

## §F · Codex review checkpoint #2 (code-level)

Per spec §17.1 step 7. After all tasks land and tests pass, full diff is handed to Codex for adversarial review.

- [ ] **Step F.1: Generate the cumulative diff**

  ```bash
  git diff origin/main...HEAD > /tmp/sprint-1-diff.patch
  wc -l /tmp/sprint-1-diff.patch
  ```

- [ ] **Step F.2: Invoke `codex:rescue` with the diff + plan + spec**

  ```
  Spawn codex:rescue with:
    Read: /tmp/sprint-1-diff.patch
    Read: docs/superpowers/specs/2026-04-25-v1-customer-experience-design.md
    Read: docs/superpowers/specs/2026-04-25-sprint-1-order-to-portal-plan.md
    Question: "Adversarial code review of Sprint 1 against the spec + plan.
    High-priority axes:
      - RLS bypass paths (any way to read another user's order via the new portal queries?)
      - Open-redirect in /auth/callback `next` param
      - Race conditions: webhook funded-flip + admin funded-flip + duplicate IPN
      - Email dispatch idempotency (duplicate sends on webhook retry?)
      - Stack & Save server-side enforcement (can client forge a discount?)
      - Account-claim email leaking magic-link to a non-customer (e.g., what if email is mistyped at checkout — does a stranger get a magic link?)
      - SQL injection / XSS in email templates / customer profile rendering
      - Rate-limit bypass on requestMagicLink
      - Tracking number arrival before status reaches funded
      - Migration reversibility
    Categorize High / Medium / Low with concrete fix suggestions."
  ```

- [ ] **Step F.3: Resolve every High and Medium finding inline**

  For each finding: write a regression test FIRST that reproduces the issue, then fix the code, then re-run tests.

- [ ] **Step F.4: Re-run all checks**

  ```bash
  npm test
  npx tsc --noEmit
  npm run lint
  npm run lint:content
  ```

  All must pass with zero failures.

- [ ] **Step F.5: Commit Codex fixes**

  ```bash
  git commit -am "fix: sprint 1 — codex review #2 resolutions"
  ```

---

## §G · Verification before merge

Per spec §17.2.

- [ ] All tests pass (`npm test`)
- [ ] Type check passes (`tsc --noEmit`)
- [ ] Lint passes (`npm run lint`)
- [ ] Content lint passes (`npm run lint:content`)
- [ ] Manual UI verification via Claude Preview — screenshots captured for cart drawer at 1/3/5/8/12 vials; checkout footnote; `/login` flow; `/account` dashboard; `/account/orders/[id]`
- [ ] Codex review #2 has zero unresolved High/Medium findings
- [ ] Magic-link round-trip tested live (real email arriving, link clicked, session active)
- [ ] RLS adversarial test passes against the staging Supabase project
- [ ] PR description includes:
  - Summary of changes (one paragraph)
  - Test plan summary (link to §A)
  - Codex review #1 findings + resolutions (link)
  - Codex review #2 findings + resolutions (link)
  - Manual verification screenshots
  - Migration reversibility note

---

## §H · Post-merge

- [ ] Apply migrations 0004, 0005 (and 0006 if added) to production via Supabase MCP — same SQL files
- [ ] Set production env vars: `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `RESEND_FROM_EMAIL`, `AUTH_REDIRECT_URL` (if used)
- [ ] Smoke test in production: place a real order with a test email, walk the full claim → portal flow
- [ ] Update [docs/superpowers/specs/2026-04-25-v1-customer-experience-design.md](2026-04-25-v1-customer-experience-design.md) §15 success criteria — strike through items now satisfied by this sprint
- [ ] Schedule Sprint 2 brainstorm + plan kick-off

---

## Self-review notes

**Spec coverage:** Sprint 1 covers spec §2 (auth), §3 (Stack & Save + same-SKU multiplier), §5 (portal — dashboard / orders / detail; subscription/messages/referrals greyed for Sprint 2-3), §9.1 (Editorial direction in 3 new emails), §10 (card-processor narrative — page + footnote + email line), §11 (migrations 0004 + 0005 + 0006), §16.4 (UX-to-close per surface — §E above), §17 (quality gates — §C plan-level codex; §F code-level codex; §G verification).

**Out of scope for Sprint 1 (intentional):** subscriptions (Sprint 2), messaging (Sprint 3), referral program (Sprint 3), affiliate program (Sprint 4), Sprint 0 visual rebrand (separate).

**Spec sections NOT explicitly delivered yet that need a follow-up sprint:**
- §16.1 visual system principles — Sprint 0 (rebrand)
- §16.2 surfaces in Sprint 0 scope
- §16.3 explicit Sprint 0 out-of-scope items

**Risk areas to watch during execution:**
- Account-claim email going to mistyped email addresses (Codex review #2 must scrutinize)
- RLS interaction with the existing service-role admin queries (admin path must continue to work — admin uses service role)
- Stack & Save rounding when subtotal is odd-cent values
- Concurrent webhook + admin-action funded flips
