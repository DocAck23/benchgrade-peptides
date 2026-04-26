# Sprint 2 — Subscription Commerce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Ship the custom-stack subscription system — signup at checkout (Prepay/Monthly toggle × 1/3/6/9/12 mo durations × monthly/quarterly/once ship cadence), 4 new transactional emails, bill-pay setup instructions, and customer-portal management (view + pause/resume/cancel + swap stack).

**Architecture:** New `subscriptions` table linked to existing `orders` (each cycle ships as a fresh order with `subscription_id` set). Discount math layers on top of Stack & Save engine — when subscription is selected, the subscription discount REPLACES the Stack & Save tier (subscription = bigger deal). Cycle scheduling is admin-driven for v1 (admin clicks "fire next cycle" in dashboard); cron lands v2.

**Tech Stack:** Same as Sprint 1 (Next.js 16, Supabase Auth, Resend, Tailwind v4). No new dependencies.

**Spec source:** [2026-04-25-v1-customer-experience-design.md §4 + §5](2026-04-25-v1-customer-experience-design.md). Read §4.1–4.7, §5 portal route map, §9.3 email roster items 6–9 before starting.

**Sprint 1 patterns to reuse:** TDD strict, staging guards before commit, Codex review checkpoint at end, Editorial email direction via `editorialEmailHtml` helper, RLS-scoped portal queries via `createServerSupabase`, atomic state transitions via `.update().in('status', sources)`.

---

## §A · Test plan (write before any production code)

### A.1 — Unit (vitest, pure functions)

| ID | Subject | Behaviour |
|---|---|---|
| U-SUBPRICE-1 | `subscriptionDiscountPercent` | prepay 1mo → 5%, 3mo → 18%, 6mo → 25%, 9mo → 30%, 12mo → 35% |
| U-SUBPRICE-2 | `subscriptionDiscountPercent` | bill-pay 3mo → 10%, 6mo → 15%, 9mo → 18%, 12mo → 20% (no 1mo on bill-pay) |
| U-SUBPRICE-3 | `subscriptionDiscountPercent` | invalid combo (bill-pay 1mo) → 0 |
| U-SUBPRICE-4 | `subscriptionDiscountPercent` | ship-once cadence on prepay → +3% bonus on top of duration discount |
| U-SUBTOTAL-1 | `computeSubscriptionTotals` | $400 stack × 6mo prepay → $1,800 (25% off retail × 6) |
| U-SUBTOTAL-2 | `computeSubscriptionTotals` | $400 stack × 12mo prepay ship-once → $400 × 12 × (1 - 0.35 - 0.03) = $2,976 |
| U-SUBTOTAL-3 | `computeSubscriptionTotals` | per-cycle total when monthly bill-pay is the cadence |
| U-CYCLE-1 | `nextCycleDate` | given subscription start + ship cadence monthly, next ship = start + 30 days |
| U-CYCLE-2 | `nextCycleDate` | quarterly cadence → +90 days |
| U-CYCLE-3 | `nextCycleDate` | ship-once → null (no next cycle) |
| U-EMAIL-SS-1 | `subscriptionStartedEmail` | subject: `"Your subscription is active — BGP-SUB-<first8>"` |
| U-EMAIL-SS-2 | `subscriptionStartedEmail` | body shows stack contents, plan duration, payment cadence, next ship date |
| U-EMAIL-SS-3 | `subscriptionStartedEmail` | bill-pay path shows the bill-pay setup instructions block |
| U-EMAIL-SC-1 | `subscriptionCycleShipNoticeEmail` | subject: `"Cycle N of M shipped — BGP-SUB-<first8>"` |
| U-EMAIL-SC-2 | `subscriptionCycleShipNoticeEmail` | body shows tracking + COA links per the existing shipped pattern |
| U-EMAIL-SP-1 | `subscriptionPaymentDueEmail` | subject: `"Payment due in 5 days — Cycle N of M"` |
| U-EMAIL-SP-2 | `subscriptionPaymentDueEmail` | body explicitly notes 5-day grace before auto-cancel |
| U-EMAIL-SR-1 | `subscriptionRenewalEmail` | fires 7 days before plan ends; body offers 1-click renew with same discount tier |

### A.2 — Integration (vitest with mocked Supabase server client)

| ID | Subject | Behaviour |
|---|---|---|
| I-SUB-1 | `createSubscription` | inserts a row with all fields, links the order; returns `{ ok, subscription_id }` |
| I-SUB-2 | `createSubscription` | when `payment_cadence='bill_pay'` and `plan_duration_months=1` → returns `{ ok: false, error: 'Invalid combination' }` |
| I-SUB-3 | `pauseSubscription` | atomic transition active → paused; refuses paused → paused (rowcount = 0 → error) |
| I-SUB-4 | `resumeSubscription` | atomic transition paused → active; computes next_ship_date from now |
| I-SUB-5 | `cancelSubscription` | atomic transition (active|paused) → cancelled; sets cancelled_at |
| I-SUB-6 | `swapSubscriptionItems` (admin-only in v1) | replaces items jsonb; logs admin who made change |
| I-RLS-SUB-1 | RLS adversarial | authenticated user A cannot read user B's subscription |
| I-RLS-SUB-2 | RLS adversarial | authenticated user A CAN update their own subscription (pause/cancel) |
| I-RLS-SUB-3 | RLS adversarial | authenticated user A CANNOT update user B's subscription |
| I-CHECKOUT-SUB-1 | submitOrder with subscription mode | creates the first-cycle order AND the subscription row AND fires `subscriptionStartedEmail` AND `accountClaimEmail` (existing) |
| I-CHECKOUT-SUB-2 | submitOrder with subscription mode | second order on same subscription_id is rejected by atomic insert (subscription_id is unique on creation cycle) |

### A.3 — Component (UI behaviour)

| ID | Subject | Behaviour |
|---|---|---|
| C-CHECKOUT-SUB-1 | `<SubscriptionUpsellCard/>` | renders Prepay/Monthly toggle; Prepay default selected; 5 duration buttons (1/3/6/9/12) for prepay; 4 (3/6/9/12) for bill-pay |
| C-CHECKOUT-SUB-2 | `<SubscriptionUpsellCard/>` | live total preview reflows when toggle/duration changes |
| C-CHECKOUT-SUB-3 | `<SubscriptionUpsellCard/>` | ship cadence selector (Monthly default, Quarterly, Once-and-extra-3%-off) |
| C-CHECKOUT-SUB-4 | submitOrder integration | when "Subscribe to this stack" toggled ON, a hidden form field `subscription_mode` is submitted with the cart |
| C-PORTAL-SUB-1 | `/account/subscription` | shows current subscription with status pill, next ship date, stack items, plan terms |
| C-PORTAL-SUB-2 | `/account/subscription` | pause / resume / cancel buttons fire the matching server actions; UI reflects new state |
| C-PORTAL-SUB-3 | `/account/subscription` | when no active sub → empty state with "Subscribe & save" CTA |
| C-PORTAL-SUB-4 | `<AccountNav/>` | "Subscription" tab is no longer greyed out; routes to /account/subscription |

### A.4 — Manual smoke (Claude Preview)

| ID | Surface | Action |
|---|---|---|
| M-SUB-1 | Cart with 3 vials → Checkout | Subscription upsell card visible; toggle Prepay/Monthly; pick 6mo prepay; total preview = $X |
| M-SUB-2 | Submit subscription order | Receives 4 emails: confirmation + admin + account-claim + subscription-started |
| M-SUB-3 | `/account/subscription` after sign-in | Shows the active sub with pause/cancel buttons working |
| M-SUB-4 | Bill-pay path | After submit, separate email with bill-pay instructions; subsequent cycles only ship after credit lands |

---

## §B · File structure

### Files to create

```
supabase/migrations/
  0007_add_subscriptions.sql                     # subscriptions table + orders.subscription_id + RLS

src/lib/subscriptions/
  discounts.ts                                   # subscriptionDiscountPercent, computeSubscriptionTotals
  cycles.ts                                      # nextCycleDate, billPayInstructions
  __tests__/discounts.test.ts                    # U-SUBPRICE-*, U-SUBTOTAL-*
  __tests__/cycles.test.ts                       # U-CYCLE-*

src/lib/email/
  templates.ts                                   # MODIFIED — add 4 new templates
  __tests__/templates.test.ts                    # MODIFIED — add U-EMAIL-SS/SC/SP/SR

src/lib/email/notifications/
  send-subscription-emails.ts                    # NEW — sendSubscriptionStarted, sendCycleShipNotice, sendPaymentDue, sendRenewal
  __tests__/send-subscription-emails.test.ts

src/app/actions/
  subscriptions.ts                               # NEW — createSubscription, pauseSubscription, resumeSubscription, cancelSubscription
  __tests__/subscriptions.test.ts                # I-SUB-*
  orders.ts                                      # MODIFIED — submitOrder branches on subscription_mode
  admin.ts                                       # MODIFIED — adminFireNextCycle, adminSwapSubscriptionItems

src/app/account/subscription/
  page.tsx                                       # NEW — current sub view + actions
  manage/page.tsx                                # NEW — edit stack (admin-approval v1)

src/components/account/
  SubscriptionCard.tsx                           # NEW — read-only sub view (used in dashboard + sub page)
  SubscriptionActions.tsx                        # NEW — client component, pause/resume/cancel buttons

src/components/checkout/
  SubscriptionUpsellCard.tsx                     # NEW — Prepay/Monthly toggle + duration buttons + ship cadence + live total
  __tests__/SubscriptionUpsellCard.test.tsx      # C-CHECKOUT-SUB-*

src/lib/supabase/types.ts                        # MODIFIED — add SubscriptionRow type, extend OrderRow.subscription_id
```

### Files to modify

```
src/app/checkout/CheckoutPageClient.tsx          # render <SubscriptionUpsellCard/>; pass subscription_mode to submitOrder
src/components/account/AccountNav.tsx            # un-grey "Subscription" tab; route to /account/subscription
src/app/account/page.tsx                         # dashboard: replace "Subscription coming" placeholder with <SubscriptionCard/> when active
src/lib/cart/CartContext.tsx                     # expose `subscriptionMode` toggle state (so cart drawer can preview)
src/lib/cart/types.ts                            # extend CartApi
```

---

## §C · Wave coordination

**Wave A (3 parallel agents — zero file overlap):**
1. **A1** — Migration 0007 + supabase types extension (subscriptions table, RLS policies, orders.subscription_id FK, SubscriptionRow type)
2. **A2** — Subscription pure logic: `discounts.ts` + `cycles.ts` + their tests
3. **A3** — 4 new email templates + send-subscription-emails helper + their tests

**Wave B (2 parallel agents — file overlap minimal):**
1. **B1** — Subscription server actions (createSubscription / pause / resume / cancel) — touches `actions/subscriptions.ts` (new), `actions/admin.ts` (additive, append-only)
2. **B2** — Checkout integration: `<SubscriptionUpsellCard/>` component + submitOrder branching + cart context exposure of subscription_mode toggle

**Wave C (solo agent):**
- **C1** — Portal pages: `/account/subscription`, `/account/subscription/manage`, dashboard `<SubscriptionCard/>` integration, AccountNav un-grey

**Wave D (verification + migration apply):**
- Codex adversarial review #3
- Apply migration 0007 to live Supabase
- Resolve any High/Medium findings

---

## §D · UX-to-close commitments per surface (spec §16.4)

| Surface | Commitment |
|---|---|
| `<SubscriptionUpsellCard/>` | Single card, Prepay/Monthly toggle visible top, durations as horizontal pill row, live total preview in oxblood mono-data, "you save $X" callout |
| Bill-pay flow | After submit, separate dedicated email with bank-bill-pay setup instructions formatted for visual scanning (large font, monospace fields, clear "memo: BGP-SUB-XXX") |
| `/account/subscription` | Status pill at top, stack items with thumbnails, next-ship date prominent in mono, pause/cancel buttons clearly secondary (gold-bordered outlines, not destructive red) |
| Empty state on `/account/subscription` | "Subscribe & save 18-35%" with the catalog CTA — empty state is a sales surface |
| Cancel confirmation | Two-step (button → confirm dialog with "you'll lose your discount tier" reminder) — friction by design to reduce churn |
| All emails | Single primary CTA per email; subscription-started shows next 3 ship dates inline so the customer knows what to expect |

---

## §E · Discount math contract

Sprint 1's `computeCartTotals` returns Stack & Save tier + Same-SKU multiplier. Sprint 2's subscription mode REPLACES the Stack & Save tier with the subscription discount when active:

```ts
// Pseudocode
function computeCartTotalsForCheckout(items, subscriptionMode) {
  const baseTotals = computeCartTotals(items);
  if (!subscriptionMode) return baseTotals;
  const subPercent = subscriptionDiscountPercent(
    subscriptionMode.duration,
    subscriptionMode.cadence,
    subscriptionMode.shipCadence
  );
  // Subscription discount REPLACES Stack & Save tier (it's strictly bigger)
  // Same-SKU multiplier still applies on top of subscription discount
  const sub_discount_cents = Math.round(baseTotals.subtotal_cents * (subPercent / 100));
  const post_sub = baseTotals.subtotal_cents - sub_discount_cents;
  const sameSku = computeSameSkuMultiplier(items);
  const same_sku_discount_cents = Math.round(post_sub * (sameSku / 100));
  return {
    ...baseTotals,
    stack_save_tier_percent: 0,                // overridden by subscription
    stack_save_discount_cents: 0,
    subscription_discount_percent: subPercent,
    subscription_discount_cents: sub_discount_cents,
    same_sku_discount_cents,
    total_cents: post_sub - same_sku_discount_cents,
  };
}
```

This integration lives in `src/lib/cart/discounts.ts` (extended, not replaced) so that the checkout summary can render either Stack & Save mode or Subscription mode based on the toggle state. Add tests U-COMBO-SUB-1..3 covering the override behavior.

---

## §F · Codex review checkpoint #3

After all waves land:
- Generate cumulative diff `git diff <pre-sprint-2>..HEAD`
- Dispatch via `Agent { subagent_type: "codex:codex-rescue" }` (NOT Skill — that path doesn't work)
- Review axes specific to Sprint 2:
  1. **Subscription discount math correctness** — is the override of Stack & Save in subscription mode bulletproof? Can a client toggle subscription_mode in the form without server validation and get the bigger discount?
  2. **Cycle race conditions** — admin "fire next cycle" + bill-pay credit detection: can both fire and create two orders for the same cycle?
  3. **Subscription RLS** — same axes as orders RLS but for the new table
  4. **Pause/resume edge cases** — what if a customer pauses mid-cycle? Does the pre-paid amount carry forward?
  5. **Cancel with refund** — spec says no auto-refunds; cancel just stops future cycles. Verify no path tries to refund automatically.
  6. **Bill-pay reconciliation** — incoming ACH credit must match a specific cycle. What's the matching heuristic? Likely amount + customer name + cycle-due date. Document the heuristic and add a test.
  7. **Email idempotency on cycle ship** — same pattern as Sprint 1 (atomic UPDATE with status filter)
  8. **Migration 0007 reversibility**

---

## §G · Phasing summary

Sprint 2 ships when:
- A new customer can pick "Subscribe to this stack — 6 month prepay" at checkout, pay $X upfront via wire/ACH/Zelle/crypto, and see their subscription in `/account/subscription` after sign-in
- They receive 4 emails: confirmation + admin + account-claim + subscription-started (with next 3 ship dates)
- Admin can "fire next cycle" from the admin dashboard, which creates a fresh order linked to the subscription and ships it
- Customer can pause/resume/cancel from `/account/subscription`
- Bill-pay flow renders setup instructions in a dedicated email after the first cycle clears
- All cumulative diff passes Codex review #3 with zero unresolved High/Medium findings
