# V1 Customer Experience — Design Spec

**Status:** Draft for review
**Date:** 2026-04-25
**Scope:** Post-purchase customer platform — auth, portal, subscriptions, messaging, referrals, affiliates, emails, Stack & Save, card-processor narrative.
**Out of scope (v2+):** Loyalty/points, real-time chat, ACH auto-debit, full custom-affiliate dashboard.

---

## 1. Strategic context

In April 2026, the premium RUO peptide tier just lost its biggest brand: **Peptide Sciences was shut down in March 2026** after independent testing exposed purity as low as 75%. Amino Asylum and Science.bio are also gone. The premium-tier survivors are Praetorian Peptides, Limitless Biotech, and Liberty Peptides — none of which combine Bench Grade's positioning of *USA-made + per-lot QR-COA + monthly virtue branding*.

Bench Grade's pricing is correctly placed in the premium tier (Retatrutide 60mg @ $14.17/mg vs Liberty $14.40/mg vs ex-PS $18.40/mg). The strategic move is **claim the void left by PS** with a stronger trust narrative ("verified per lot, receipts on every vial, no purity scandals here") — not to lower prices to chase the discount tier.

V1 builds the post-purchase platform that converts that positioning into recurring revenue: portal, subscriptions, messaging, referrals, premium-grade emails.

---

## 2. Authentication & accounts

**Decision: Magic-link primary, optional password upgrade.**

- Account auto-created at first checkout. Customer enters email at checkout → after submit, two emails fire:
  1. Order received + payment instructions
  2. "Claim your portal" with magic-link to sign in
- Magic link signs them in directly to `/account`. Future logins via `/login` → request magic link.
- After first login, `/account/security` offers an optional "Set a password" upgrade. Password is opt-in, never required.
- Order ownership: every order has a `customer_user_id` (nullable until claimed). On first claim, system backfills any orders matching the email address.

---

## 3. Pricing strategy

**Hold list prices.** Bench Grade is correctly positioned in the premium tier. Two layered discount mechanics:

### 3.1 Stack & Save (one-shot orders)
Volume ladder applied automatically in cart, regardless of which SKUs are present:

| Vials | Reward |
|---|---|
| 2 | Free domestic shipping |
| 3 | 15% off + free shipping |
| 5 | 20% off + free shipping |
| 8 | 25% off + free shipping + free 5mg vial of choice |
| 12+ | 28% off + free shipping + free 10mg vial of choice |

Live cart UI shows progress to next tier ("Add 2 more vials → 20% off").

### 3.2 Same-SKU multiplier
**5+ vials of the same SKU in cart = additional 5% off the entire order.** Stacks with Stack & Save tier discount. Rewards bulk-of-one without changing list pricing.

### 3.3 Explicitly NOT in scope
- No "size-up nudge" recommending the larger SKU. Size-tier per-mg discount is the premium-tier norm; routing customers to bigger packs costs ~$700+ margin per high-tier compound (validated against Retatrutide and Tirzepatide cost analysis).
- No big-pack repricing. Current per-mg structure matches Liberty Peptides exactly.

---

## 4. Subscriptions ("Subscribe & Save")

**Decision: Custom stack + duration plan + payment cadence. No fixed tiers; tiers ARE the duration commitments.**

### 4.1 Stack
Customer builds any combination of vials and quantities. No vial-count cap. Subscription "stack" = the cart contents at signup.

### 4.2 Plan durations
Five upfront-pay durations: **1 / 3 / 6 / 9 / 12 months.** Monthly bill-pay durations: **3 / 6 / 9 / 12 months** (no 1-month — that's just a one-shot order).

### 4.3 Payment cadence
Two paths, customer chooses at checkout:

| Path | Mechanism | Risk |
|---|---|---|
| **Pay upfront** | Single payment via wire / ACH / Zelle / crypto for the full plan | Zero collection risk |
| **Pay monthly via bank bill-pay** | Customer configures recurring transfer in their own bank's bill pay → ACH credit lands monthly. We never store account info, never pull. | Customer can cancel/skip; we ship only after credit lands per cycle |

**Bill-pay first-cycle handling:** customer pays month 1 by wire/Zelle/crypto/ACH at checkout (treated like any one-shot order). Subscription is "active" once month 1 funds clear. Customer is then emailed bill-pay setup instructions for cycles 2+. We ship each subsequent cycle only after that cycle's bill-pay credit lands; if it's late, we hold and email a 5-day grace reminder before auto-cancelling that cycle.

Auto-debit ACH ("we pull from customer") is explicitly out of scope — same RUO compliance fight as cards.

### 4.4 Discount structure

**Pay upfront:**
| Plan | Discount |
|---|---|
| 1 mo | 5% off |
| 3 mo | 18% off |
| 6 mo | 25% off |
| 9 mo | 30% off |
| 12 mo | 35% off |

**Pay monthly via bill-pay:**
| Plan | Discount |
|---|---|
| 3 mo | 10% off |
| 6 mo | 15% off |
| 9 mo | 18% off |
| 12 mo | 20% off |

### 4.5 Shipment cadence
Customer choice at signup:
- **Ship monthly** (default) — cold-chain pack per cycle, premium "subscription unboxing" feel
- **Ship quarterly** — every 3 months, fewer touchpoints
- **Ship-once** — entire plan shipped in one cold-chain box; **+3% additional discount** as a value lever

Lyophilized stability is 2–3 years refrigerated, so any cadence is product-safe. Storage info (2–8°C, light-protected, reconstituted shelf-life note) accompanies every shipment AND every confirmation email.

### 4.6 Order processing
Orders begin processing **only after payment is received**. Auto-status flips:
- Crypto: NowPayments webhook (already wired)
- Wire / ACH / Zelle / customer-bill-pay: admin marks `funded` in dashboard once credit lands
- Status flip → triggers "Payment confirmed, packing your order" email (NEW)
- Shipment with tracking → triggers "Shipped" email (NEW)

### 4.7 Subscription upsell (at checkout)
Cart-level Stack & Save discount displays first. Below it, a "Subscribe & Save more" card with:
- **Prepay / Monthly toggle** (top of card)
- **Duration buttons** (1/3/6/9/12 mo) showing the discount % for the active toggle
- Live total preview reflowing as the customer changes selection
- "Pay monthly via bank bill pay" requires the customer to commit at signup; setup instructions emailed after submit

---

## 5. Customer portal

`/account` (authenticated). Tabs:

| Route | Purpose |
|---|---|
| `/account` | Welcome dashboard: recent orders, active subscription summary, message threads, referral link card |
| `/account/orders` | Order list with status pills (awaiting payment / funded / shipped / delivered) |
| `/account/orders/[id]` | Order detail: items, status timeline, tracking link, COA-per-lot QR/PDF, "Reorder" button |
| `/account/subscription` | Active sub: items, next ship date, next payment date, pause/resume/cancel actions |
| `/account/subscription/manage` | Edit stack contents (subject to admin approval if mid-cycle) |
| `/account/messages` | Persistent thread with admin (see §6) |
| `/account/referrals` | Customer referral link, count of successful referrals, free-vial credits earned |
| `/account/profile` | Email, default ship address, billing email, password (optional) |
| `/account/security` | Magic-link logins, optional password set, active sessions |

**RLS policies (Supabase):** Customers can read only their own orders, subscriptions, messages, and referrals. Compliance evidence (`ruo_acknowledgments`) stays service-role-only — never readable by the customer who signed it.

---

## 6. Messaging system

**Decision: Persistent thread per customer + email notifications.** No real-time, no per-order threads in v1.

- One ongoing conversation between customer and admin, accessed at `/account/messages`
- Admin sees all threads in admin dashboard, replies inline
- When admin replies → customer gets email notification ("New message from Bench Grade — view in your portal")
- Polling-based (auto-refresh every 30s while page open). No websockets in v1.
- New messages are stored as rows in a `messages` table with `customer_user_id`, `sender` (`customer` | `admin`), `body`, `created_at`, `read_at`.

**v1.5 enhancement candidate:** Per-order threads (so questions about specific lots/tracking stay tied to context). Land after we see what real customer questions look like.

---

## 7. Referral program (customer-side)

**Decision: Every customer gets a unique referral code/link after their first paid order.**

- Code format: `/r/<slug>` where slug is a memorable token (e.g., `AHMED-NK4`)
- Visible in `/account/referrals` with a copy button + share-via-text/email actions
- New visitor clicks link → cookie set with referral code (60-day window) → 10% off auto-applied to their first-ever order
- New customer's first order with **5+ vials** → an entitlement to one free 5mg vial is granted; **vial choice is selected by the customer at checkout** before submission (not pre-assigned)
- **Referrer reward:** 1 free 5mg vial entitlement per successful referral. Stacks. The referrer selects which 5mg vial they want at the time they place their *next* order (entitlement appears in their cart as "available redemption").
- Successful referral = referee's first order ships (status = `shipped`). Refund within 30 days reverses the credit and any unredeemed entitlement.

---

## 8. Affiliate program (v1.5)

**Decision: Lands shortly after v1 launch. Tiered, lifetime commission, redeemable for vials.**

### 8.1 Tier structure

| Tier | Promotion threshold | Commission | Personal vial discount | Redemption | Perks |
|---|---|---|---|---|---|
| **Bronze** | Default at signup | 10% | 10% off | $1 = $1.10 credit | Dashboard, monthly payouts |
| **Silver** | 5+ refs OR $1k commission | 12% | 15% off | $1 = $1.20 credit | Free domestic shipping on personal orders |
| **Gold** | 15+ refs OR $5k commission | 15% | 20% off | $1 = $1.30 credit | Priority shipping, early access to new compounds, Founders' Circle quarterly call |
| **Eminent** | 50+ refs OR $25k commission | 18% | 25% off | $1 = $1.40 credit | Monthly free 5mg vial, dedicated point-of-contact, virtue-of-the-month early seal |

### 8.2 Mechanics
- Application page: `/affiliate/apply` (gated)
- Affiliate dashboard at `/account/affiliate` (only visible if affiliate flag is set)
- **Lifetime commission:** affiliate earns commission on EVERY order from referred customers, forever — including subscriptions
- **Cookie attribution:** 60 days from click
- **Click model:** first-click wins. Original referring affiliate keeps lifetime attribution permanently, even if customer later clicks another affiliate's link.
- **Refund clawback:** commission reversed if order refunded within 30 days
- **Self-referral fraud:** affiliate cannot use their own code; system blocks orders from same IP/email
- **Payout floor:** $50 minimum balance per Zelle/crypto payout, monthly cycle
- **Affiliates ≠ customer-referrers:** same `/r/CODE` URL mechanic on the front-end, different reward path on back-end. Affiliates get cash commission only (not free vials). Customer-referrers get free vials (not cash).

---

## 9. Email design

**Decision: Editorial direction (letter-from-the-founder).**

### 9.1 Aesthetic
- Serif headlines (Georgia / Cormorant fallback)
- Sans-serif body (Helvetica / Inter system fallback)
- Cream paper background (`#FDFAF1`), oxblood accent (`#6E1423`), near-black ink (`#111`)
- Top-center wordmark with virtue-of-the-month seal beneath
- Generous spacing, single-column, max 600px width
- Tone: premium without stuffy, confident without cocky, research-respectful, calm

### 9.2 All emails render multiple payment methods
The order received email shows the customer's *selected* method in the primary instructions block, with other rails listed compactly below ("Or pay via: ACH, Zelle, crypto — instructions for any method on request").

### 9.3 Email roster (v1)
1. **Order Received + Payment Instructions** — fires on `submitOrder` (already exists, redesigned)
2. **Account Claim** — fires alongside #1 on first order; magic-link CTA
3. **Magic-Link Sign-In** — on `/login` request
4. **Payment Confirmed** — fires on status flip to `funded` (NEW)
5. **Order Shipped** — with tracking + COA links (NEW)
6. **Subscription Started** — confirmation of stack, cadence, next ship/charge dates
7. **Subscription Cycle Ship Notice** — recurring per shipment
8. **Subscription Payment Due** — bill-pay path only; reminder before each cycle
9. **Subscription Renewal** — fires before plan ends with renewal options
10. **Referral Claimed** — to referrer when their friend's first order ships
11. **New Message from Admin** — link to portal thread
12. **Affiliate Commission Earned** (v1.5) — monthly summary
13. **Affiliate Payout Sent** (v1.5) — payment confirmation

### 9.4 Storage info
Every shipment confirmation email includes a "Storage & handling" panel with:
- Lyo: 2–8°C refrigerated (or –20°C freezer for 6+ months)
- Light-protect; do not freeze-thaw repeatedly
- Reconstitute only when ready to use; per-peptide reconstituted shelf life on the COA
- The same content also goes on the printed insert card in every box

---

## 10. Card-processor narrative

**Decision: Both placements (subtle inline + dedicated page).**

- **Checkout footnote:** small italic text under the payment selector: *"Card processing coming soon — every order strengthens our case for premium merchant approval. Thank you for being part of it."*
- **Order email line:** after wire instructions, a single paragraph: *"Why no cards? RUO peptides face heavy merchant scrutiny. We're building the reputation to unlock card processing — your order helps us get there."*
- **Dedicated page** at `/why-no-cards` — full explanation: regulatory landscape, why premium RUO suppliers stay off cards, what merchant approval looks like, why this is a feature not a bug. Linked from checkout: *"Why no cards? Read our note →"*

This page also serves SEO (long-tail "research peptides without credit card processing"), and provides journalists/regulators a principled stance to read.

---

## 11. Database changes (summary)

New migrations needed (exact column lists deferred to writing-plans phase):

| Migration | Purpose |
|---|---|
| `0004_add_tracking.sql` | `orders.tracking_number`, `tracking_carrier`, `shipped_at` |
| `0005_customer_users.sql` | `orders.customer_user_id` + RLS read policies |
| `0006_subscriptions.sql` | `subscriptions` table (id, customer_user_id, plan_duration_months, payment_cadence, ship_cadence, items jsonb, status, next_ship_date, next_charge_date, created_at, cancelled_at) |
| `0007_subscription_orders.sql` | `orders.subscription_id` link |
| `0008_messages.sql` | `messages` table (id, customer_user_id, sender, body, created_at, read_at) |
| `0009_referrals.sql` | `referrals` table (referrer_id, referee_id, code, attributed_at, redeemed_at, status) + `referral_codes` table |
| `0010_affiliate_program.sql` (v1.5) | `affiliates`, `affiliate_commissions`, `affiliate_payouts` tables; tier promotion logic |

---

## 12. Phasing

**Sprint 1 (v1 core — order to portal):**
1. Add tracking columns + payment-confirmed + shipped emails (smallest unblock)
2. Supabase Auth magic-link + claim flow
3. RLS read policies + customer-orders portal (`/account`, `/account/orders`, `/account/orders/[id]`)
4. Stack & Save ladder + cart progress UI + same-SKU multiplier
5. Card-processor narrative (checkout footnote + email line + `/why-no-cards`)

**Sprint 2 (v1 commerce expansion):**
6. Subscription model (schema, signup at checkout, prepay/monthly toggle, shipment cadence)
7. Subscription emails (started, cycle ship, payment due, renewal)
8. Bill-pay setup instruction generation
9. Subscription portal pages (`/account/subscription`, `/manage`)

**Sprint 3 (v1 retention):**
10. Messaging system (persistent thread + email notifs + polling)
11. Referral program (customer-side: codes, free-vial credits, dashboard)

**Sprint 4 (v1.5 affiliate program):**
12. Affiliate application + tier engine + commission ledger + dashboard + payout flow

---

## 13. Out of scope for v1 / v1.5

- **Loyalty / points / milestone rewards** — no points-per-dollar, no milestone vials beyond the referral free-vial. Re-evaluate at $200k/mo revenue.
- **Real-time chat** — polling only. Websockets are v2.
- **ACH auto-debit** ("we pull from customer") — same compliance fight as cards. Skip indefinitely; revisit only after card processing is live.
- **Per-order message threads** — single thread per customer in v1; per-order threads when usage data justifies.
- **Stack-Credit prepaid balance** — escheatment / gift-card legal risk; needs lawyer review.
- **Reserved Stack manual monthly** — covered by bank-bill-pay instead.
- **Custom build-your-own subscription box UI** — already covered by "any cart contents" model; no separate UX surface.
- **Loyalty tier badges in customer profile** — "virtue of the month" handles recurring engagement without a separate badge system.

---

## 14. Open implementation questions (defer to writing-plans phase)

1. **Subscription cycle billing dates:** anniversary-based (e.g., 1st cycle Apr 25, next cycle May 25) or calendar-aligned (next 1st of month)? Anniversary is simpler; calendar is friendlier for buyers who pay bills monthly.
2. **Bank bill-pay instruction format:** what fields does the customer enter into their bank? (Beneficiary name, address, account, routing, memo format with order/sub ID for reconciliation.)
3. **COA-per-lot QR URL pattern:** `/coa/<lot-id>` returning lot-scoped public page. Persistence across many lots → which storage backend.
4. **Tracking number capture flow:** admin form input vs. inbound email parsing from carriers.
5. **Referral attribution edge cases:** what if attribution cookie is cleared between click and purchase? (Server-side associate-on-magic-link-claim mitigates partially.)
6. **Bill-pay reconciliation:** bank ACH credits land without our internal subscription ID — match heuristic on amount + customer-name fuzzy match + cycle-due date.
7. **Affiliate first-click attribution storage:** do we store every click or just successful referrals?

---

## 15. Success criteria

V1 ships when:
- A new customer can place a one-shot order with Stack & Save tier discount applied
- They receive a payment-instructions email AND an account-claim magic link
- They can sign in to `/account` and see their order with status pill + COA-per-lot
- Admin can mark the order `funded` and `shipped`; customer receives both emails
- A customer can subscribe (any cart, any duration, prepay or bill-pay), pay, and see their subscription in their portal
- A customer can message the admin and receive replies via email + portal thread
- A customer can copy their referral link and successful referrals add free-vial credit to their account
- The `/why-no-cards` page is live with the full narrative
- All 11 v1 emails render in the Editorial design

V1.5 ships affiliate program after v1 has 30+ days of real production traffic.

---

## 16. Brand pivot — Cartier-tier luxury (Sprint 0 prerequisite)

V1 is shipping behind a **brand pivot from clinical-modern to luxury-supreme**. Reference point: Cartier — heritage typography, deliberate whitespace, sparingly-used signature red, embossed/foil-feel detailing. The Editorial email direction (§9) is the leading edge of this pivot; everything else (storefront, portal, emails, packaging inserts) follows the same system.

**This MUST land in Sprint 0 before functional v1 work begins.** Otherwise we'd build features against a stale visual system and rework everything.

### 16.1 Visual system principles (locked from final logo, 2026-04-25)

The finalized logo is an embossed gold engraving on deep wine — a 19th-century apothecary scientist at a microscope, ringed by a laurel wreath, with "BENCH GRADE PEPTIDES" set in monumental Roman caps below. **This sets the entire visual direction.** Reference: heritage Cartier × scientific apothecary.

**Principles:**
- **Less, but heavier.** Generous whitespace. Restrained ornament. Every detail intentional.
- **Type-led hierarchy.** Display Roman caps for headlines, transitional serif for editorial body, geometric sans for UI, monospace for data only.
- **Two-surface system.** Cream surfaces (default pages, forms, catalog) and wine surfaces (hero, premium tiers, packaging-feel sections, dark-mode emails). Gold is the accent on both.
- **Photography: artifacts, not lifestyle.** Single vial on linen or travertine. No stock lab glass. Heavy use of negative space. Vials shot against wine paper for premium contexts.
- **Microinteractions: slow and deliberate.** 250–400ms ease-out transitions. No bouncy springs. No spinners — content-shaped skeletons or progress bars.
- **Laurel + apothecary motif** carries through: virtue-of-the-month emblem, affiliate Eminent tier badge, wax-seal mark on subscription confirmations.

#### Locked design tokens (Tailwind v4 `@theme`)

| Token | Hex | Use |
|---|---|---|
| `--color-wine` | `#4A0E1A` | Primary brand background, hero, premium tier surfaces, packaging |
| `--color-wine-deep` | `#2E0810` | Shadow / depth accent on wine surfaces |
| `--color-gold` | `#B89254` | Primary accent — wordmarks, rules, signature elements |
| `--color-gold-light` | `#D4B47A` | Hover states, soft-emboss highlights |
| `--color-gold-dark` | `#8B6E3F` | Pressed states, secondary depth |
| `--color-paper` | `#FDFAF1` | Default page background (warm cream) |
| `--color-paper-soft` | `#F4EBD7` | Card backgrounds, table stripes, secondary surfaces |
| `--color-ink` | `#1A0506` | Body text on cream — wine-tinged near-black |
| `--color-ink-soft` | `#4A2528` | Secondary text on cream |
| `--color-ink-muted` | `#6B5350` | Tertiary, eyebrow labels, fine print |
| `--color-rule` | `#D4C8A8` | Hairline dividers on cream surfaces |
| `--color-rule-wine` | `#6E2531` | Hairline dividers on wine surfaces |
| `--color-success` | `#3F6B47` | Confirmation states (sparingly used) |
| `--color-danger` | `#7A2128` | Error / refund / cancel states |

#### Locked typography

| Token | Family | CSS variable | Use |
|---|---|---|---|
| Display | **Cinzel** (Google Fonts — closest free analogue to the wordmark's Roman capitals) | `--font-display` | Hero headlines, virtue marks, the wordmark, premium-tier titles, packaging |
| Editorial | **Cormorant Garamond** | `--font-editorial` | Email headlines, /why-no-cards copy, longer prose, blog-style content |
| UI | **Inter** | `--font-sans` | Navigation, forms, transactional body, dashboard surfaces |
| Data | **JetBrains Mono** | `--font-mono` | Prices, lot numbers, COA IDs, order IDs, SKU strings |

All four are loaded via `next/font/google` in `src/app/layout.tsx`. Geist (currently in the stack) is removed.

#### Logo asset locations (to be created)

- `public/brand/logo.png` — full color logo (gold on wine), 2400×1260 (matches reference image dimensions)
- `public/brand/logo-mark.svg` — vector mark (laurel + scientist + wordmark)
- `public/brand/logo-mark-gold-on-cream.svg` — alt for cream surfaces
- `public/brand/logo-mark-cream-on-wine.svg` — alt for dark-mode email headers
- `public/brand/wordmark-only.svg` — wordmark without the seal (for tight spaces)
- `public/brand/seal-mark.svg` — laurel+scientist seal alone (without wordmark)
- `public/brand/virtue-seal-honorable.svg` — current virtue-of-the-month seal

Components consume these via `<Logo variant="full|mark|wordmark|seal" surface="cream|wine">` in `src/components/brand/Logo.tsx`.

### 16.2 Surfaces in scope for Sprint 0
- New design tokens (Tailwind v4 theme block + CSS vars in [globals.css](src/app/globals.css))
- Updated [Header.tsx](src/components/layout/Header.tsx), [Footer.tsx](src/components/layout/Footer.tsx), [RUOBanner.tsx](src/components/layout/RUOBanner.tsx)
- Updated [ProductCard.tsx](src/components/catalog/ProductCard.tsx), [ProductCarousel.tsx](src/components/catalog/ProductCarousel.tsx), [VariantPicker.tsx](src/components/catalog/VariantPicker.tsx)
- Updated [CartDrawer.tsx](src/components/cart/CartDrawer.tsx), [CheckoutPageClient.tsx](src/app/checkout/CheckoutPageClient.tsx)
- Logo + wordmark replacement in [Logo.tsx](src/components/brand/Logo.tsx) (waiting on final asset)
- Email base layout + atom components (header, divider, button, summary table, signature block)
- New homepage hero copy + visual treatment
- Loading, empty, and error states across all surfaces

### 16.3 Out of scope for Sprint 0 (still part of pivot, but later)
- Marketing site updates beyond the homepage
- Catalog photography re-shoot (placeholder vials acceptable in v1; shoot lands v1.5)
- `/why-no-cards` editorial page (built in Sprint 1 with the new system)
- Custom illustrations / iconography (using Lucide icons throughout v1; bespoke marks in v2)

### 16.4 UX-to-close discipline (cross-cutting)
Every surface is designed to close the customer. Specific commitments:
- **Cart progress UI:** live tier-progress bar (locked in §3.1) is THE primary conversion mechanic — visible at every step from cart through checkout
- **Trust signals:** Made-in-USA, ≥99% HPLC verified, QR-COA per vial, cold-chain shipped — appear above every submit button (added to checkout in §16.2 work)
- **Subscription upsell:** prepay/monthly toggle on a single card (§4.7) — never a separate page or step
- **Form ergonomics:** address autocomplete, single column on mobile, sticky CTA, inline validation with subtle checkmarks
- **Loading states:** content-shaped skeletons, never spinners; perceived performance > actual
- **Microcopy:** confident, calm, third-person plural research voice ("Your stack ships within 1–2 business days of payment confirmation"). Never bro, never wellness-cliché.
- **Email CTAs:** singular per email, oxblood accent, never more than one ask per send
- **Post-purchase momentum:** order-received email arrives within 60s of submit; account-claim email follows within 90s; payment-confirmed email fires on status flip; shipped email with tracking + COA links closes the loop
- **Empty states:** every empty state is a sales surface (empty cart → "Browse the catalog" + featured 4-vial Honorable Stack)

---

## 17. Quality gate / build process

Every sprint follows the user-mandated 7-step workflow. **No shortcuts.** This is enforced per-PR.

### 17.1 The seven steps

For each feature in each sprint:

1. **Plan tests first.** Before any production code, write a test plan: what's the contract, what are the edge cases, what are the integration points, what's mockable, what's not. Test plan lives in the implementation plan doc.
2. **Plan the code.** Architecture, files touched, components, server actions, schema migrations, RLS policies. Lives in the implementation plan doc.
3. **Codex adversarial review #1 — plan-level.** Hand the plan + spec section to Codex via `codex:rescue` for adversarial critique. What's missing? What breaks? What's overengineered? Resolve all flagged issues in the plan before any code.
4. **Build with TDD.** Tests first (red), implementation (green), refactor. Use `superpowers:test-driven-development` discipline.
5. **Test execution.** Run the full test suite: vitest (unit), integration tests against a local Supabase, manual browser pass via Claude Preview against the Next.js dev server.
6. **Debug + iterate.** Use `superpowers:systematic-debugging` for any failure — root-cause analysis, no symptom-patching.
7. **Codex adversarial review #2 — code-level.** Diff handed to Codex via `codex:rescue` after the implementation passes step 5. Adversarial review of the actual code. Resolve every High/Medium finding before merge.

### 17.2 Verification before merge
Per `superpowers:verification-before-completion`:
- All tests pass (`npm test`)
- Type check passes (`tsc --noEmit`)
- Lint passes (`npm run lint`)
- Content compliance lint passes (`npm run lint:content`)
- Manual UI verification via Claude Preview (screenshot + interaction trace)
- Codex review #2 has zero unresolved High/Medium findings
- The PR description includes the test plan + codex review summary

### 17.3 Skills wired into the workflow
- `superpowers:writing-plans` — produces each sprint's implementation plan (this is the next step after this brainstorm closes)
- `superpowers:test-driven-development` — discipline during step 4
- `superpowers:systematic-debugging` — discipline during step 6
- `codex:rescue` — adversarial review at steps 3 and 7
- `superpowers:verification-before-completion` — gate before claiming sprint complete
- `superpowers:requesting-code-review` — at PR creation
- `frontend-design` (`12ab35c2eb56:frontend-design`) — Sprint 0 visual system work

### 17.4 PRD structure
Each sprint's implementation plan is its own document, named `docs/superpowers/specs/YYYY-MM-DD-sprint-N-<topic>-plan.md`. The plan is the contract between this spec and the implemented code. The spec answers WHAT and WHY. The plan answers HOW. Code is built against the plan, not the spec.
