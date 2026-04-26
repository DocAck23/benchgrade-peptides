# Sprint 3 — Messaging + Customer Referrals Implementation Plan

> **Execution skill:** superpowers:subagent-driven-development.

**Goal:** Ship the customer messaging system (persistent thread per customer + admin reply UI + email notifications + polling) AND the customer referral program (post-purchase code/link, click-attribution, free-vial entitlement on referrer's next order, referee 10%-off-first-order auto-applied).

**Architecture:** Two new tables (`messages`, `referrals`). Messaging uses polling (no websockets in v1). Referrals use a 60-day cookie attribution + first-click-wins. Free-vial entitlement is granted to referrer on referee's first paid order — appears in cart as a redeemable item at next checkout.

**Tech Stack:** Same. No new dependencies.

**Spec source:** [v1 design spec](2026-04-25-v1-customer-experience-design.md) §6 (messaging), §7 (customer referral). Read both fully before starting.

**Patterns to reuse from Sprints 1–2:** TDD strict, staging guards before commit, `editorialEmailHtml` wrapper, atomic state transitions via `.update().in('status', sources)`, RLS-scoped portal queries via `createServerSupabase`, locked Tailwind utilities (no legacy refs).

---

## §A · Test plan

### A.1 — Unit
| ID | Subject | Behaviour |
|---|---|---|
| U-MSG-1 | `composeMessageHtml` | escapes user-supplied body; preserves line breaks via `<br>` |
| U-MSG-2 | `formatThreadTimestamp` | "Apr 25 · 4:18 pm" format from ISO string |
| U-REF-1 | `generateReferralCode` | returns memorable slug ~7-9 chars, unique per call (low collision) |
| U-REF-2 | `validateReferralCode` | accepts `^[A-Z0-9]{4,12}$`, rejects others |
| U-REF-3 | `cookieAttribution.parse` | reads cookie, returns `{ code, attributedAt }` or null |
| U-REF-4 | `cookieAttribution.set` | sets cookie with 60-day expiry, HttpOnly, SameSite=Lax |
| U-EMAIL-MN-1 | `messageNotificationEmail` | subject "New message from Bench Grade · BGP-MSG-<first8>" |
| U-EMAIL-RE-1 | `referralEarnedEmail` | subject "Free vial earned — your friend's first order shipped" |

### A.2 — Integration
| ID | Subject | Behaviour |
|---|---|---|
| I-MSG-1 | `sendCustomerMessage` (server action) | inserts message row with `sender='customer'`, RLS-scoped via cookie client |
| I-MSG-2 | `sendAdminMessage` (admin server action) | inserts with `sender='admin'`; fires `messageNotificationEmail` to customer |
| I-MSG-3 | RLS adversarial — user A cannot read user B's messages |
| I-MSG-4 | RLS adversarial — user A cannot UPDATE another user's messages (mark-read) |
| I-MSG-5 | `markMessagesRead` — atomic UPDATE; only updates rows where `sender='admin' AND read_at IS NULL` |
| I-REF-1 | `claimReferralOnOrder` (called inside submitOrder when cookie present) — links order to referral code; grants entitlement on referrer when this is referee's first order shipped |
| I-REF-2 | First-click-wins: when referee already has a referral attribution, second click does not overwrite |
| I-REF-3 | Self-referral block: referrer's own email cannot redeem their own code |
| I-REF-4 | RLS — user can SELECT own referral codes + entitlements only |
| I-CHECKOUT-REF-1 | submitOrder — when referral cookie + first order → 10% auto-applied at checkout |
| I-ENTITLEMENT-1 | `redeemFreeVialEntitlement` — atomic decrement of unredeemed entitlement count; returns the chosen vial SKU as a free line on the order |

### A.3 — Component / UI
| ID | Subject | Behaviour |
|---|---|---|
| C-MSG-1 | `<MessageThread/>` renders messages chronologically; admin avatar gold-on-paper-soft, customer avatar paper-soft |
| C-MSG-2 | `<MessageComposer/>` textarea + send button; disabled while sending |
| C-MSG-3 | `<MessageThread/>` polls every 30s (configurable); auto-scrolls to latest on new |
| C-MSG-4 | Mark-read fires when message visible in viewport |
| C-REF-1 | `<ReferralCard/>` shows the customer's link with copy button; success state confirms |
| C-REF-2 | `<ReferralCard/>` shows successful-referrals count, free-vial credits earned |
| C-REF-3 | `/account/referrals` empty state when 0 referrals: educational + share CTA |
| C-NAV-1 | `<AccountNav/>` un-grey Messages + Referrals tabs; route to /account/messages and /account/referrals |

---

## §B · File structure

### Create
```
supabase/migrations/0008_messages_table.sql
supabase/migrations/0009_referrals_and_codes.sql

src/lib/messaging/
  format.ts                                      # composeMessageHtml, formatThreadTimestamp
  __tests__/format.test.ts

src/lib/referrals/
  codes.ts                                       # generateReferralCode, validateReferralCode
  cookie.ts                                      # cookieAttribution.parse / set
  __tests__/codes.test.ts
  __tests__/cookie.test.ts

src/lib/email/
  templates.ts                                   # MODIFIED — add messageNotificationEmail, referralEarnedEmail
  __tests__/templates.test.ts                    # MODIFIED — append U-EMAIL-MN, U-EMAIL-RE
  notifications/send-messaging-emails.ts         # NEW — sendMessageNotification helper
  notifications/send-referral-emails.ts          # NEW — sendReferralEarned helper
  notifications/__tests__/...

src/app/actions/
  messaging.ts                                   # NEW — sendCustomerMessage, listMyMessages, markMessagesRead
  referrals.ts                                   # NEW — claimReferralOnOrder, generateMyReferralCode, redeemFreeVialEntitlement
  __tests__/messaging.test.ts
  __tests__/referrals.test.ts
  admin.ts                                       # MODIFIED — adminSendMessage (additive), adminListAllThreads (additive)
  orders.ts                                      # MODIFIED — claimReferralOnOrder hook + entitlement redemption hook

src/app/account/messages/page.tsx
src/app/account/referrals/page.tsx
src/app/api/messaging/poll/route.ts              # GET endpoint for poll-based message updates

src/components/account/
  MessageThread.tsx                              # client — renders messages, polls
  MessageComposer.tsx                            # client — textarea + send
  ReferralCard.tsx                               # server — link + count + CTA
  ReferralLinkCopy.tsx                           # client — copy button with success state
  AccountNav.tsx                                 # MODIFIED — un-grey Messages + Referrals
```

### Modify
```
src/lib/supabase/types.ts                        # MessageRow, ReferralRow, ReferralCodeRow, FreeVialEntitlementRow
src/components/account/AccountNav.tsx            # un-grey 2 tabs
src/app/account/page.tsx                         # dashboard: message-thread CTA card → /account/messages
src/app/actions/orders.ts                        # call claimReferralOnOrder + grant entitlement on first-order-shipped (or on submitOrder for first-order-discount auto-apply)
src/app/checkout/CheckoutPageClient.tsx          # if referral cookie present, show 10% applied as discount line
```

---

## §C · Wave coordination

**Wave A (3 parallel — non-overlapping):**
- A1: Migrations 0008 (messages) + 0009 (referrals + codes + entitlements) + types extension
- A2: Pure logic (`messaging/format.ts`, `referrals/codes.ts`, `referrals/cookie.ts`) + tests
- A3: 2 new email templates + 2 send helpers + tests

**Wave B (2 parallel):**
- B1: Server actions (messaging + referrals + orders.ts integration for referral claim) — touches `actions/messaging.ts` (new), `actions/referrals.ts` (new), `actions/admin.ts` (additive append), `actions/orders.ts` (additive — referral cookie hook in submitOrder)
- B2: API route `/api/messaging/poll` + UI components (`MessageThread`, `MessageComposer`, `ReferralCard`, `ReferralLinkCopy`)

**Wave C (solo):**
- C1: Portal pages (`/account/messages`, `/account/referrals`) + AccountNav un-grey + dashboard integration + checkout 10%-off referral discount line

**Wave D (verification — folded into final cumulative review):**
- Apply migrations 0008 + 0009 to live Supabase
- Run final Codex review across all 4 sprints (Sprint 1–4) at end before merge

---

## §D · UX-to-close commitments

| Surface | Commitment |
|---|---|
| `/account/messages` | Single thread, latest at bottom; admin avatar in gold (signal of authority); empty state has educational CTA "Got a question? Ask us." |
| `<MessageComposer/>` | Single-purpose textarea; send button gold-bordered; max 2000 chars with character counter at 1800+ |
| `<MessageNotificationEmail>` | Subject preview shows first 60 chars of admin reply; CTA goes straight to thread (deep link to /account/messages) |
| `/account/referrals` | Hero card: "Earn free vials. Help your friends." with the customer's referral link prominent + copy button; below: count of successful referrals + free-vial credits available; empty state educates on the program |
| `<ReferralLinkCopy/>` | One click copies; success state confirms with check icon and "Link copied" inline message; share-via-text/email/whatsapp deep-link buttons |
| Checkout when referral cookie present | "Referred by friend · 10% off applied" line in the order summary aside, before subtotal |
| Free-vial entitlement at checkout | Banner at top of cart drawer: "You have 1 free 5mg vial waiting — pick at checkout" with vial selector dropdown on the next checkout |

---

## §E · Schema design

### `messages` table (migration 0008)

```sql
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  sender text not null check (sender in ('customer', 'admin')),
  body text not null check (length(body) > 0 and length(body) <= 2000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index messages_customer_user_id_idx on public.messages (customer_user_id, created_at desc);
create index messages_unread_admin_idx on public.messages (customer_user_id, sender, read_at)
  where sender = 'admin' and read_at is null;

alter table public.messages enable row level security;

create policy "customers_read_own_messages"
  on public.messages for select to authenticated
  using (customer_user_id = auth.uid());

create policy "customers_insert_own_messages"
  on public.messages for insert to authenticated
  with check (customer_user_id = auth.uid() and sender = 'customer');

create policy "customers_update_own_messages_read"
  on public.messages for update to authenticated
  using (customer_user_id = auth.uid())
  with check (customer_user_id = auth.uid());
-- Field-restriction (only `read_at` mutable) enforced server-side.
```

### `referrals` + `referral_codes` + `free_vial_entitlements` (migration 0009)

```sql
-- Each customer has ONE referral code (generated post-first-order)
create table public.referral_codes (
  code text primary key check (code ~ '^[A-Z0-9]{4,12}$'),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create unique index referral_codes_owner_idx on public.referral_codes (owner_user_id);

-- Each successful referral: one row per referee
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referee_user_id uuid references auth.users(id) on delete set null,  -- nullable until claim
  referee_email text not null,                                          -- captured at order time
  code text not null references public.referral_codes(code) on delete cascade,
  attributed_at timestamptz not null default now(),
  redeemed_at timestamptz,                                              -- when referrer's free-vial credit was applied
  status text not null default 'pending' check (status in ('pending', 'shipped', 'redeemed', 'cancelled')),
  first_order_id uuid references public.orders(order_id) on delete set null,
  created_at timestamptz not null default now()
);
create index referrals_referrer_idx on public.referrals (referrer_user_id, created_at desc);
create index referrals_code_idx on public.referrals (code);
create unique index referrals_referee_email_per_code_idx on public.referrals (code, lower(referee_email));

-- Free-vial credits: granted to referrer when referee's first order ships
create table public.free_vial_entitlements (
  id uuid primary key default gen_random_uuid(),
  customer_user_id uuid not null references auth.users(id) on delete cascade,
  size_mg integer not null check (size_mg in (5, 10)),
  source text not null check (source in ('referral', 'stack_save_8', 'stack_save_12', 'admin_grant')),
  source_referral_id uuid references public.referrals(id) on delete set null,
  granted_at timestamptz not null default now(),
  redeemed_at timestamptz,
  redeemed_order_id uuid references public.orders(order_id) on delete set null,
  status text not null default 'available' check (status in ('available', 'redeemed', 'expired'))
);
create index free_vial_entitlements_customer_status_idx on public.free_vial_entitlements (customer_user_id, status);

-- RLS — same pattern as orders/subscriptions
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.free_vial_entitlements enable row level security;

-- Anyone authenticated can SELECT a referral_code by code (so attribution lookup works)
create policy "anyone_read_referral_codes" on public.referral_codes for select to authenticated using (true);

-- Customers see their own referrals (as referrer)
create policy "customers_read_own_referrals" on public.referrals for select to authenticated
  using (referrer_user_id = auth.uid());

-- Customers see their own entitlements
create policy "customers_read_own_entitlements" on public.free_vial_entitlements for select to authenticated
  using (customer_user_id = auth.uid());

-- All INSERT/UPDATE service-role only.
```

---

## §F · Codex review checkpoint

Folded into the final cumulative review across all 4 sprints (per user direction "merge them all together once completed"). Sprint 3 specific axes:
1. Self-referral fraud — can a customer use their own code on their own second account?
2. Cookie attribution overwrite — first-click wins guard
3. Free-vial entitlement double-redemption (atomic UPDATE)
4. Messaging RLS — can a customer see another customer's thread?
5. Message body XSS — escapeHtml on send and on render?
6. Email-typo at checkout (referee email mismatch with eventual auth.users email)
7. Polling endpoint rate-limiting

---

## §G · Sprint 3 success criteria

Sprint 3 ships when:
- A customer can post a message via `/account/messages`; admin sees and replies; customer gets email + sees reply on next poll
- A customer can copy their referral link from `/account/referrals` and share
- A new visitor clicking the referral link gets 10% off their first order auto-applied at checkout
- After the referee's first order ships, the referrer sees a free-vial entitlement on `/account/referrals` and can redeem at next checkout
- All RLS adversarial tests pass
- Migrations 0008 + 0009 applied to live Supabase
