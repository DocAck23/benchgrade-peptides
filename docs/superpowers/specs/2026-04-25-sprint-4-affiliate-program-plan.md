# Sprint 4 — Affiliate Program v1.5 Implementation Plan

> **Execution skill:** superpowers:subagent-driven-development.

**Goal:** Ship the formal affiliate program — application page, 4-tier engine (Bronze/Silver/Gold/Eminent), 10-18% lifetime commission on referrals, monthly cash payouts (Zelle/crypto), commission-to-vial redemption with 1.10–1.40× bonuses, personal vial purchase discounts (10/15/20/25%), affiliate dashboard.

**Architecture:** Affiliates are an additive role layered on top of customers — when an authenticated customer is approved as an affiliate, an `affiliates` row is created. Their referral_code (from Sprint 3) is reused; the difference is the BACKEND reward path:
- Customer-referrer (Sprint 3): free 5mg vial entitlement on referee's first order shipped
- Affiliate (Sprint 4): cash commission % on EVERY order (lifetime), accumulating in a `commission_ledger` table

The existing `referrals` table works for both — what differentiates is presence of an `affiliates` row matching the referral's referrer_user_id, and the `commission_amount_cents` field on each referral.

**Tech Stack:** Same. No new dependencies.

**Spec source:** [v1 design spec](2026-04-25-v1-customer-experience-design.md) §8 (full affiliate program).

---

## §A · Test plan

### A.1 — Unit
| ID | Subject | Behaviour |
|---|---|---|
| U-AFFTIER-1 | `affiliateTier` | 0 refs / $0 commission → Bronze |
| U-AFFTIER-2 | `affiliateTier` | 5 refs OR $1k → Silver |
| U-AFFTIER-3 | `affiliateTier` | 15 refs OR $5k → Gold |
| U-AFFTIER-4 | `affiliateTier` | 50 refs OR $25k → Eminent |
| U-AFFCOMM-1 | `commissionPercent(tier)` | Bronze=10, Silver=12, Gold=15, Eminent=18 |
| U-AFFDISC-1 | `personalVialDiscount(tier)` | Bronze=10%, Silver=15%, Gold=20%, Eminent=25% |
| U-AFFREDEEM-1 | `redemptionRatio(tier)` | Bronze=1.10, Silver=1.20, Gold=1.30, Eminent=1.40 |
| U-AFFCALC-1 | `computeCommission(orderTotal, tier)` | $1000 × Bronze 10% = $100 |
| U-AFFCALC-2 | `computeCommission` | refund clawback within 30d → negative entry |
| U-EMAIL-AFFAPP-1 | `affiliateApplicationApprovedEmail` subject "Welcome to the Bench Grade Affiliate Program" |
| U-EMAIL-AFFCOMM-1 | `affiliateCommissionEarnedEmail` subject "You earned $X this month — BGP-AFF-<first8>" |
| U-EMAIL-AFFPAY-1 | `affiliatePayoutSentEmail` subject "Payout sent: $X via <method>" |

### A.2 — Integration
| ID | Subject | Behaviour |
|---|---|---|
| I-AFFAPP-1 | `applyForAffiliate` — creates pending row in `affiliate_applications` |
| I-AFFAPP-2 | `adminApproveAffiliate` — promotes application to affiliate; creates referral_code if not present |
| I-AFFCOMM-1 | When a referee's order is funded AND referrer is an affiliate, a `commission_ledger` row is INSERTed |
| I-AFFCOMM-2 | When same order is refunded within 30d, a clawback ledger row is inserted (negative) |
| I-AFFCOMM-3 | Tier promotion is automatic — when commission ledger crosses threshold, affiliate.tier updates |
| I-AFFPAY-1 | `adminProcessPayout(affiliateId, amount, method)` — creates payout row, marks ledger entries as paid |
| I-AFFPAY-2 | Payout below $50 floor → rejected |
| I-AFFREDEEM-1 | `redeemCommissionForVialCredit(amount)` — atomic decrement of available_balance; creates entitlement at tier ratio |
| I-RLS-AFF-1 | RLS — affiliates can SELECT own commission_ledger rows; cannot see others |

### A.3 — UI
| ID | Subject | Behaviour |
|---|---|---|
| C-AFFAPP-1 | `/affiliate/apply` form with name/email/audience-description/website fields |
| C-AFFDASH-1 | `/account/affiliate` shows tier badge, commission balance, referral count, recent ledger entries, redemption controls |
| C-AFFDASH-2 | Tier progress bar shows distance to next tier |
| C-AFFDASH-3 | Personal-discount banner: "Your X% affiliate discount applies at checkout" (tier-aware) |

---

## §B · File structure

### Create
```
supabase/migrations/0010_affiliate_program.sql                # affiliates, affiliate_applications, commission_ledger, payouts

src/lib/affiliate/
  tiers.ts                                                    # affiliateTier, commissionPercent, personalVialDiscount, redemptionRatio
  commission.ts                                               # computeCommission, computeClawback
  __tests__/tiers.test.ts
  __tests__/commission.test.ts

src/lib/email/
  templates.ts                                                # MODIFIED — add 3 affiliate templates
  notifications/send-affiliate-emails.ts                     # NEW — sendApplicationApproved, sendCommissionEarned, sendPayoutSent

src/app/actions/
  affiliate.ts                                                # NEW — applyForAffiliate, getMyAffiliateState, redeemCommissionForVialCredit
  admin.ts                                                    # MODIFIED — adminApproveAffiliate, adminProcessPayout (additive)
  orders.ts                                                   # MODIFIED — emit commission ledger entry on funded transition (additive hook)

src/app/affiliate/apply/page.tsx                              # PUBLIC application form
src/app/account/affiliate/page.tsx                            # affiliate dashboard (auth-gated)

src/components/affiliate/
  TierBadge.tsx                                               # tier visual (Bronze/Silver/Gold/Eminent, gold accents per tier)
  CommissionLedgerTable.tsx                                   # paginated history
  TierProgressBar.tsx                                         # "X more refs to Silver"
  RedeemCommissionForm.tsx                                    # client form
  ApplicationForm.tsx                                         # public application form
```

### Modify
```
src/lib/supabase/types.ts                                     # AffiliateRow, AffiliateApplicationRow, CommissionLedgerRow, PayoutRow
src/components/account/AccountNav.tsx                         # add "Affiliate" tab (visible only when isAffiliate)
src/app/account/page.tsx                                      # dashboard: show affiliate card when applicable
src/app/checkout/CheckoutPageClient.tsx                       # apply personal-discount when authenticated user is affiliate
src/app/actions/orders.ts                                     # commission ledger hook on funded
```

---

## §C · Wave coordination

**Wave A (3 parallel):**
- A1: Migration 0010 + supabase types extension
- A2: Pure logic (tiers + commission) + tests
- A3: 3 affiliate emails + send helpers

**Wave B (2 parallel):**
- B1: Server actions (applyForAffiliate, getMyAffiliateState, redeemCommission, admin approve/payout, orders.ts commission hook)
- B2: UI components (TierBadge, CommissionLedgerTable, TierProgressBar, RedeemCommissionForm, ApplicationForm)

**Wave C (solo):**
- /affiliate/apply page + /account/affiliate dashboard + AccountNav conditional tab + dashboard integration + checkout personal discount

---

## §D · Schema

### Migration 0010

```sql
-- affiliate_applications: pending review
create table public.affiliate_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_email text not null,
  applicant_name text not null,
  audience_description text not null check (length(audience_description) <= 2000),
  website_or_social text,
  applicant_user_id uuid references auth.users(id) on delete set null,  -- nullable when applying before signup
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by_admin text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index affiliate_applications_status_idx on public.affiliate_applications (status, created_at desc);

-- affiliates: approved
create table public.affiliates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  application_id uuid references public.affiliate_applications(id) on delete set null,
  tier text not null default 'bronze' check (tier in ('bronze', 'silver', 'gold', 'eminent')),
  payout_method text not null default 'zelle' check (payout_method in ('zelle', 'crypto', 'wire')),
  payout_handle text,                                  -- Zelle ID, crypto wallet, etc.
  available_balance_cents integer not null default 0,  -- redeemable commission balance
  total_earned_cents integer not null default 0,
  total_paid_cents integer not null default 0,
  total_redeemed_cents integer not null default 0,     -- redeemed for vial credit
  approved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index affiliates_user_id_idx on public.affiliates (user_id);

-- commission_ledger: each entry = a commission earned (or clawed back)
create table public.commission_ledger (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  source_referral_id uuid references public.referrals(id) on delete set null,
  source_order_id uuid references public.orders(order_id) on delete set null,
  kind text not null check (kind in ('earned', 'clawback', 'redemption_debit', 'payout_debit')),
  amount_cents integer not null,                        -- positive for earned, negative for clawback/debit
  tier_at_time text not null,                           -- snapshot of tier when earned
  created_at timestamptz not null default now()
);

create index commission_ledger_affiliate_idx on public.commission_ledger (affiliate_id, created_at desc);
create index commission_ledger_referral_idx on public.commission_ledger (source_referral_id);

-- payouts: monthly batch payment record
create table public.affiliate_payouts (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 5000),  -- $50 floor
  method text not null check (method in ('zelle', 'crypto', 'wire')),
  external_reference text,                              -- transaction ID
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  notes text
);

create index affiliate_payouts_affiliate_idx on public.affiliate_payouts (affiliate_id, created_at desc);

-- RLS
alter table public.affiliate_applications enable row level security;
alter table public.affiliates enable row level security;
alter table public.commission_ledger enable row level security;
alter table public.affiliate_payouts enable row level security;

create policy "applicants_read_own_applications" on public.affiliate_applications for select to authenticated
  using (applicant_user_id = auth.uid());

create policy "affiliates_read_own_row" on public.affiliates for select to authenticated
  using (user_id = auth.uid());

create policy "affiliates_read_own_ledger" on public.commission_ledger for select to authenticated
  using (affiliate_id in (select id from public.affiliates where user_id = auth.uid()));

create policy "affiliates_read_own_payouts" on public.affiliate_payouts for select to authenticated
  using (affiliate_id in (select id from public.affiliates where user_id = auth.uid()));

-- All INSERT/UPDATE service-role only.
```

---

## §E · Tier engine (src/lib/affiliate/tiers.ts)

```ts
export type AffiliateTier = 'bronze' | 'silver' | 'gold' | 'eminent';

export function affiliateTier(input: {
  successful_referrals_count: number;
  total_earned_cents: number;
}): AffiliateTier;
//  Bronze: default
//  Silver: 5+ refs OR $1k earned ($100,000 cents)
//  Gold: 15+ refs OR $5k earned
//  Eminent: 50+ refs OR $25k earned

export function commissionPercent(tier: AffiliateTier): number;
//  bronze=10, silver=12, gold=15, eminent=18

export function personalVialDiscount(tier: AffiliateTier): number;
//  bronze=10, silver=15, gold=20, eminent=25

export function redemptionRatio(tier: AffiliateTier): number;
//  bronze=1.10, silver=1.20, gold=1.30, eminent=1.40

export function nextTier(current: AffiliateTier): { tier: AffiliateTier; refs_needed: number; earnings_needed_cents: number } | null;
```

## §F · Commission engine (src/lib/affiliate/commission.ts)

```ts
export function computeCommission(orderTotalCents: number, tier: AffiliateTier): number;
//  Returns earned amount in cents = orderTotal * percent / 100, integer rounded

export function computeClawback(originalAmountCents: number): number;
//  Returns negative cents (a refund within 30d reverses the earned commission)
```

---

## §G · Codex review checkpoint

Folded into final cumulative review. Sprint 4 axes:
1. Self-affiliate fraud (affiliate using own code)
2. Commission inflation via fake orders
3. Clawback race when refund processes
4. Payout race (admin double-clicks)
5. Tier promotion correctness on commission threshold
6. RLS adversarial — affiliate sees other affiliate's ledger?

---

## §H · Sprint 4 success criteria

- A non-customer can apply for affiliate at /affiliate/apply
- Admin approves; applicant becomes an affiliate with a code reused from referral system
- When their referee's order goes `funded`, a commission ledger entry is created (gated on isAffiliate check)
- Affiliate sees commission balance, tier, recent ledger at /account/affiliate
- Affiliate can redeem commission for vial credit at tier ratio
- Admin can process monthly payout (≥$50 floor)
- Tier auto-promotes when threshold crossed
- Migration 0010 applied to live Supabase
