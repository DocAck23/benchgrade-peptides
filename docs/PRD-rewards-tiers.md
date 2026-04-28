# PRD — Bench Grade Peptides Rewards, Tiers & Raffle

**Status:** Approved 2026-04-28. Build starts at G1.
**Owner:** Founder
**Author:** Spec captured from founder design conversation 2026-04-28

---

## 1. Problem & Goal

The customer base is research-grade peptide buyers — repeat purchasers with high lifetime value. The existing affiliate program (W9-required, manual payout) only addresses the long tail of formal partners. **Every other customer is leaving referral and retention value on the table.**

This system turns every signed-in customer into a soft affiliate by giving them:
- A persistent, prestige-driven status that climbs as they buy and refer
- A discount on every order they place (modest at low tiers, capped at 10%)
- A discount on the personal referral link they share (so referees go through them, not direct)
- A points currency that earns on every dollar — own and referred — redeemable for store credit, vials, shipping, or extra raffle entries
- Monthly raffle entries scaled by tier + spend + referral activity

**Success criteria (90 days post-launch):**
- ≥ 30% of orders attached to a signed-in customer (vs. guest-checkout rate)
- ≥ 15% of new orders arrive via a referral link
- ≥ 25% MoM growth in unique referrers active in a calendar month
- < 1% margin compression on average post-discount cart vs. pre-launch baseline

---

## 2. Scope

### In scope
- 5-tier status system (Initiate → Researcher → Principal → Fellow → Laureate)
- Two-bucket points ledger (tier-points + redeemable balance)
- Tier-driven own-order discount on initial price
- Tier-driven referral-link discount on initial price (first-order-only for the referee)
- Mutually-exclusive promo-code-or-points checkout choice
- Points redemption catalog (store credit, vials, raffle entries, free shipping)
- Monthly raffle with formula-driven entry counts, alternating cash/vial prizes
- Customer `/account/rewards` page
- Admin tooling for credit/debit, raffle config, winner draw
- Email notifications for tier-ups, referral conversions, raffle wins

### Out of scope (explicitly deferred)
- Tier visibility to other customers (private to self per founder)
- Public leaderboards
- Stacking promo codes WITH points (mutually exclusive by design)
- Subscription-specific bonus rates (handled via existing subscription discount system)
- Geographic / SKU-restricted tiers
- Lifetime tier tracking (rolling 12-month is the source of truth)
- Tier-gated SKU access (everyone sees everything)

---

## 3. User Stories

### Customer
- **C1.** As a signed-in customer, I see my current tier and points balance on my dashboard so I know my status without hunting.
- **C2.** As a customer browsing the catalogue, I see *my* personal price (after tier discount) on every product card so I don't have to compute it at checkout.
- **C3.** As a customer at checkout, I am prompted to choose either a promo code OR my points (clearly framed as mutually exclusive) so the math stays transparent.
- **C4.** As a customer, I can redeem points for store credit, a free vial, or +1 raffle entries, with the trade-offs visible before I commit.
- **C5.** As a customer, I can copy a referral link that gives my referees a percentage off scaled by my tier — and I see the percent on the page so I know what I'm offering.
- **C6.** As a customer, I see how many raffle entries I have *this month* and what the prize is, with a countdown to the draw.
- **C7.** As a customer, I receive an email when (a) I tier up, (b) a referral converts, (c) I win the raffle.
- **C8.** As a customer who loses a tier from rolling-window decay, I see a soft warning ("you'll drop to Researcher on May 1 unless you earn 73 more points") so I can recover voluntarily.

### Admin
- **A1.** As an admin, I can manually credit or debit a customer's points with an audit-logged reason (refund, fraud claw-back, goodwill).
- **A2.** As an admin, I can configure each month's raffle prize (cash $X, or 2 vials of choice) before the draw.
- **A3.** As an admin, I can review the entries snapshot for a month, trigger the draw, and confirm the winner before the prize email goes out.
- **A4.** As an admin, I see a customer's full ledger (chronological credits/debits, source, amount) on their detail page.
- **A5.** As an admin, I can override a customer's tier in edge cases (support escalation).

---

## 4. Detailed Spec

### 4.1 Tier table

| Tier | 12-mo points | Own-order discount | Referral link gives referee | Base raffle entries |
|---|---|---|---|---|
| Initiate | 0–249 | 0% | 5% | 1 |
| Researcher | 250–999 | 2% | 6% | 3 |
| Principal | 1,000–4,999 | 5% | 7% | 6 |
| Fellow | 5,000–14,999 | 8% | 8% | 12 |
| Laureate | 15,000+ | 10% | 10% | 25 |

### 4.2 Points earning

| Action | Tier-points | Redeemable points |
|---|---|---|
| $1 of own spend (post-discount, pre-shipping) on a *funded* order | 1 | 1 |
| Referee's first funded order placed | 100 | 100 |
| $1 of referee spend (post-discount, pre-shipping) on any funded order, lifetime | 10 | 10 |

**Crediting trigger:** order transitions to `funded` status. **Reversal:** order moves to `refunded` or `cancelled` — points debited symmetrically. The ledger is the source of truth; the rewards summary is a derived read view.

### 4.3 Tier computation

- Tier-points are stored as monthly buckets (one ledger row per credit). Each bucket has a `bucket_month` (the month it was earned) and its values "age out" 12 months later — i.e., a credit earned in May 2026 contributes to tier through April 2027, then drops off.
- `current_tier_points` = sum of all credits where `bucket_month >= now() - 12 months`, minus any reversals.
- Tier is recomputed on:
  - Every points credit/debit (real-time)
  - A nightly cron job (catches month-rolloff transitions exactly at midnight UTC)
- Spending redeemable points **never** affects tier-points. The two ledgers are fully decoupled.

### 4.4 Redeemable balance

- `available_balance` = sum of all credits to the redeemable bucket minus all redemptions.
- Spending is atomic: redeem action checks balance, deducts, inserts a redemption row in one transaction.
- No expiry on redeemable balance from inactivity — only the tier-points window decays naturally.

### 4.5 Redemption catalog

| Spend | Get | Notes |
|---|---|---|
| 100 pts | $1 store credit applied to current cart | Cap: 50% of cart subtotal AFTER initial-price modifiers but BEFORE points are mutually exclusive with promos (see 4.7) |
| 500 pts | +1 raffle entry for current month | Adds to `raffle_entries` immediately; doesn't refund if month closes before redeem |
| 2,500 pts | Free 5mg vial of choice | Issued as `vial_credit` row; redeemable at any later checkout |
| 5,000 pts | Free 10mg vial of choice | Same pattern as 5mg |
| 10,000 pts | Free domestic shipping for 12 months | Sets `free_shipping_until` on user_rewards row |

### 4.6 Discount stacking

**Phase 1 — initial-price modifiers (always-on):**
1. Tier own-order discount applied to every line item
2. Referral-link discount on first-order-only for the referee

These produce the customer's *personal* price, displayed on product cards when signed in.

**Phase 2 — checkout-time modifier (customer picks ONE):**
- (a) Promo / discount code (FIRST250, etc.)
- (b) Redeemed points credit

UI clearly frames this as XOR: applying one removes the other.

**Phase 3 — automatic discounts apply on top:**
- Stack & Save / Same-SKU multi-vial discounts
- Subscription multipliers (already-existing bulk-buy logic)

### 4.7 Mutual exclusivity

The checkout form has a single "Apply promo or points" affordance. Two tabs: **Promo code** | **Use my points**. Switching tabs clears the other. Server-side validation re-asserts at submit so a hostile client can't bypass.

### 4.8 Raffle entry formula

```
entries = base_by_tier
        + floor(own_funded_spend_this_calendar_month / 25)
        + floor(referee_funded_spend_this_calendar_month / 10)
```

- Recomputed nightly + on every points credit
- Stored as a denormalized snapshot at month-end (immutable record of "who had how many entries when the draw happened")
- `own_funded_spend_this_calendar_month` and `referee_funded_spend_this_calendar_month` reset on the 1st of each calendar month (UTC)

### 4.9 Raffle draw

- One winner per month
- Run on the 1st of the next month at 09:00 UTC via cron
- Winner selection: weighted random across all entries, cryptographically random seed (Postgres `gen_random_uuid()` or `random()` is sufficient; not security-critical)
- Prize alternates: odd months → 2 vials of choice (any SKU, any size), even months → cash $500 (admin can bump to $750 per-month via config)
- Vial prizes issued as `vial_credit` rows tied to the winner; cash prizes issued as `cash_payout` rows that the founder pays via Zelle/wire/check off-platform
- Admin must **confirm** the draw result before notification email fires (prevents accidental cron-induced sends)

### 4.10 Tier visibility

- Customer sees their own tier on:
  - `/account` (welcome banner: "Welcome back, Ahmed. **Researcher** · 487 pts.")
  - `/account/rewards` (full tier card + progress bar)
  - Personalized price on catalogue when signed in
- Admin sees tier on customer detail pages, ledger views, raffle entry lists
- **Never** rendered on public pages, referral landing pages, or shared in social proof surfaces

### 4.11 Referral link semantics

- Each customer has one canonical referral code (already in `referral_codes` table — pre-existing schema)
- Link format: `https://www.benchgradepeptides.com/r/<CODE>`
- Hitting the link sets a `bgp_ref` cookie (90-day TTL)
- On checkout, the cookie's referral code is read, the referrer's tier is looked up, the referee's discount % is set from the tier table
- First-order-only — the discount applies to the referee's *first funded order* attached to that code, then never again
- Referral attribution is locked at order placement: the referrer at that moment gets all future referee-spend points, even if the referee subsequently uses someone else's link

---

## 5. Data Model

### 5.1 New tables

**`points_ledger`** (every credit / debit, append-only)
- `id` uuid PK
- `user_id` uuid FK auth.users
- `kind` enum: `'earn_own_spend' | 'earn_referee_first' | 'earn_referee_spend' | 'redeem_credit' | 'redeem_raffle_entry' | 'redeem_vial_5' | 'redeem_vial_10' | 'redeem_shipping' | 'admin_credit' | 'admin_debit' | 'reversal'`
- `tier_delta` int — change to tier-points bucket
- `balance_delta` int — change to redeemable balance
- `bucket_month` date (first-of-month, used for rolling window aging)
- `source_order_id` text nullable — for earn / reversal rows tied to an order
- `source_referral_user_id` uuid nullable — for referral earnings, the referee
- `note` text nullable — admin reason
- `created_at` timestamptz

**`user_rewards`** (denormalized state, recomputed)
- `user_id` uuid PK
- `tier` enum: `'initiate' | 'researcher' | 'principal' | 'fellow' | 'laureate'`
- `tier_points` int
- `available_balance` int
- `lifetime_points_earned` int
- `referee_count` int
- `referee_total_spend_cents` int
- `free_shipping_until` timestamptz nullable
- `recomputed_at` timestamptz

**`vial_credits`** (free vials owed to a user)
- `id` uuid PK
- `user_id` uuid FK
- `source` enum: `'redemption' | 'raffle' | 'admin'`
- `max_size_mg` int — 5, 10, or null (unrestricted for raffle wins)
- `issued_at` timestamptz
- `redeemed_at` timestamptz nullable
- `redeemed_order_id` text nullable

**`raffle_months`**
- `month` date PK (first of month)
- `prize_kind` enum: `'cash' | 'vials_2'`
- `prize_amount_cents` int nullable — for cash months
- `vial_size_cap_mg` int nullable — for vial months (null = unrestricted)
- `entry_snapshot_at` timestamptz nullable
- `winner_user_id` uuid nullable
- `drawn_at` timestamptz nullable
- `confirmed_by_admin_at` timestamptz nullable

**`raffle_entries`** (snapshot at draw time)
- `month` date FK raffle_months
- `user_id` uuid FK auth.users
- `entry_count` int
- PK (`month`, `user_id`)

**`cash_payouts`**
- `id` uuid PK
- `user_id` uuid FK
- `amount_cents` int
- `source` enum: `'raffle'`
- `source_month` date nullable
- `paid_at` timestamptz nullable
- `paid_method` enum: `'zelle' | 'wire' | 'check'` nullable
- `note` text

### 5.2 Modified tables

**`orders`** — add columns:
- `referrer_user_id` uuid nullable — locked at placement when a referral cookie was present
- `points_earned` int default 0 — denormalized for fast UI; ledger is the source of truth
- `points_redeemed` int default 0 — points spent on this order
- `tier_discount_pct` int default 0 — captured at placement (so historical orders show the rate they got)
- `referral_link_discount_pct` int default 0

**`profiles`** — no schema change; we'll add a `default_referral_visible` flag later if needed

### 5.3 RLS

- `points_ledger`: customer reads own rows. Inserts only via service role (server actions).
- `user_rewards`: customer reads own row. No customer writes.
- `vial_credits`: customer reads own rows.
- `raffle_months`: public read (so customer can see the current prize).
- `raffle_entries`: customer reads own rows.
- `cash_payouts`: customer reads own rows. Admin-only writes.

---

## 6. UX Surfaces

### 6.1 `/account` (existing, modified)
- Welcome banner adds a tier badge + points pill: "Researcher · 487 pts"
- "Next tier in 513 points" mini progress bar

### 6.2 `/account/rewards` (new)
- Hero: tier badge, points balance, raffle entries this month, current month's prize
- Progress bar to next tier
- "How you earn" mini explainer (always visible, expandable)
- Redemption catalog with one-click redeem buttons + balance check
- Recent ledger (last 20 entries)
- Past raffle results (last 6 months)

### 6.3 `/account/referrals` (existing, modified)
- Adds the user's current referral-link discount % to the share card
- Shows lifetime referees count + their total spend → points earned
- "Your link unlocks 7% off for them" framing

### 6.4 Catalogue surfaces (modified)
- When signed-in customer has tier discount > 0, every product card shows:
  - Strikethrough retail price
  - Bold personal price ("Researcher price: $124.40")
  - Tooltip: "Includes your 2% Researcher discount"

### 6.5 Checkout (modified)
- Tier discount + referral-link discount auto-applied on every line
- "Apply promo or points" widget with two tabs (Promo code | Use my points)
- Switching tabs clears the other
- If using points: slider showing "Redeem N points = $X.XX off"
- Rendered cart total recomputes live

### 6.6 Admin
- `/admin/customers/[id]` adds: ledger view, current tier override, manual credit/debit form, vial credits ledger
- `/admin/raffle` (new): list of months, configure each, draw winner, confirm, payout tracking

---

## 7. Email Notifications

| Trigger | Recipient | Subject (rough) |
|---|---|---|
| Customer crosses into a higher tier | Customer | "You're now a Researcher at Bench Grade" |
| Customer's referee places first funded order | Referrer | "Your referral landed — you earned 100 points" |
| Customer wins the monthly raffle | Winner | "You won the May raffle — claim your prize" |
| Vial credit issued (raffle or redemption) | Customer | "Your free vial credit is ready" |
| Cash payout processed | Customer | "$500 raffle payout sent via Zelle" |
| Tier-decay warning (rolling-window rolloff approaching) | Customer | "You're about to drop a tier — earn 73 points to keep your status" |

All emails go through the existing Resend pipeline + `magic-link.ts` template style. Subject lines need final copy review before launch.

---

## 8. Cron Jobs

| Job | Schedule | What it does |
|---|---|---|
| `tiers:recompute` | Nightly 02:00 UTC | Recomputes every active customer's `user_rewards` row (handles rolloff transitions) |
| `raffle:snapshot` | Last day of each month, 23:55 UTC | Writes `raffle_entries` rows for that month, freezes `raffle_months.entry_snapshot_at` |
| `raffle:draw` | 1st of each month, 09:00 UTC | Picks weighted-random winner from previous month's snapshot, sets `winner_user_id` + `drawn_at`, queues admin confirmation |
| `decay:warn` | Weekly, Sunday 14:00 UTC | Emails customers within 30 days of a tier rolloff threshold |

---

## 9. Build Sprints

**G1 — Ledger + tier engine** (foundation; ships invisible to customer)
- Migrations: `points_ledger`, `user_rewards`, `vial_credits`
- `creditPoints` / `debitPoints` / `recomputeTier` server actions
- Order-funded hook: emit credits
- Order-refunded/cancelled hook: emit reversals
- Nightly cron job
- Admin manual credit/debit form
- Tests: ledger correctness, tier rollup, rolling-window decay, reversal symmetry, RLS boundaries
- Codex adversarial pass

**G2 — Customer rewards page + price personalization**
- `/account/rewards` page + progress UI
- Tier discount applied to checkout pricing engine
- Referral-link discount captured at checkout from `bgp_ref` cookie
- Catalogue product cards show personal price when signed in
- Tests: cart pricing for every tier, edge cases (Initiate, Laureate, first-order-via-link, returning-customer-via-link → no link discount), RLS reads
- Codex adversarial pass

**G3 — Monthly raffle**
- Migrations: `raffle_months`, `raffle_entries`, `cash_payouts`
- Snapshot + draw cron jobs (sequential, idempotent)
- Customer entries-this-month UI
- Admin raffle dashboard (config + confirm + payout tracking)
- Tests: entry formula correctness for all three inputs, snapshot freeze idempotency, draw determinism for given seed, payout flow
- Codex adversarial pass

**G4 — Redemption checkout integration + emails**
- Promo-or-points XOR widget at checkout
- Vial-credit redemption alongside existing free_vial_entitlement
- All notification emails (templates + send hooks)
- Tier-decay warning cron
- Final polish + mobile audit
- Tests: every redemption path, email send hooks, mobile snapshots
- Codex adversarial pass + final review

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Margin compression at high tier + heavy redemption | Mutually-exclusive promo/points already prevents the worst case; the math (§4.6 in the design doc) confirmed even worst-case stacks stay positive on every cart > $50 |
| Tier inflation (everyone hits Laureate fast via referrals) | 12-month rolling window means customers must keep earning to stay; 15k tier threshold requires ~$1.5k of referee spend (a real number) |
| Raffle gaming (someone refers themselves through alt accounts) | Fraud guard: same-IP / same-device-fingerprint referees fail attribution; admin flag + retroactive reversal action |
| Points abuse via order-fund-then-refund cycling | Reversal rows on refund/cancel symmetrically remove the points; ledger keeps audit trail |
| Cron failure (snapshot or draw missed) | Idempotent operations + admin manual-trigger fallback; alerts on missed runs |
| Customer confusion ("why did my tier drop?") | Soft warning email 30 days before rolloff; ledger view shows exactly which earnings are aging out |
| Admin accidentally awards wrong winner | Required `confirmed_by_admin_at` step before prize emails fire; draw is reversible until confirmed |

---

## 11. Out-of-Scope Decisions Recorded

- No public leaderboard (privacy)
- No tier badge on shared referral pages (privacy)
- No promo+points stacking (margin)
- No subscription-specific tier multipliers (covered by existing subscription system)
- No tier-gated SKUs (everyone shops everything)
- No lifetime tier track (rolling window is the only window)

---

## 12. Definition of Done

- [ ] All four sprints (G1–G4) shipped to production
- [ ] Migrations applied to live Supabase
- [ ] All cron jobs registered and verified running on schedule
- [ ] All notification emails sending via Resend with correct templates
- [ ] Mobile audit passed on /account/rewards, checkout points UI, referral page
- [ ] Codex adversarial review passed at each sprint
- [ ] At least one full month of raffle dry-run completed before public launch
- [ ] First public raffle month's prize configured and visible
- [ ] Founder has used the admin tools to issue a manual credit, run a snapshot, and confirm a draw end-to-end
