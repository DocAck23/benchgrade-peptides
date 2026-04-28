# Manual Attention — items deferred from automated codex review

This file collects items that require manual or higher-touch follow-up than what the launch-sprint touched. None of these are blocking the *site going live this week* — they're the next-tier hardening items the codex passes flagged. Tackle in priority order.

---

## 1. (HIGH) Affiliate balance race in `redeemCommissionForVialCredit`

**Where:** [src/app/actions/affiliate.ts:222](../src/app/actions/affiliate.ts:222)

**Problem.** Function reads `available_balance_cents`, computes `newBalance` in JS, then writes that stale value back with only `.gte("available_balance_cents", amount)` as a guard. Two concurrent $30 redeems against a $100 balance can both succeed: both pass the gte check, both write `newBalance = 70`, balance ends at $70 instead of $40 — the affiliate just minted $30 of vial credit out of thin air.

**Fix (proper):** move the math into a Postgres RPC that does the decrement in SQL with arithmetic, locks the affiliate row `FOR UPDATE`, inserts the ledger entry + entitlement in the same transaction, and rolls back if any insert fails. Mirrors the `redeem_coupon` RPC pattern.

**Steps:**
1. Write `supabase/migrations/0023_redeem_commission_rpc.sql` with a `redeem_commission_for_vial_credit(affiliate_id, amount_cents, ...)` function.
2. Apply via Supabase MCP.
3. Refactor `redeemCommissionForVialCredit` in `src/app/actions/affiliate.ts` to call the RPC.
4. Update / extend the existing affiliate.test.ts to cover the new path.

---

## 2. (HIGH) Affiliate payout race in `adminProcessPayout`

**Where:** [src/app/actions/admin.ts:738](../src/app/actions/admin.ts:738)

**Problem.** Same pattern as #1. Concurrent admin clicks (or even one admin double-clicking) on "Process payout" both pass the `gte` guard, both write the new balance, both insert payout rows. The affiliate gets paid twice from the same balance. Also: the balance moves before the ledger/payout inserts, so a later insert failure leaves aggregates out of sync.

**Fix:** transactional RPC. Same structure as #1. Lock the affiliate row, decrement balance arithmetically, insert payout + ledger rows in the same transaction.

---

## 3. (MEDIUM) Skip-cycle race in `skipNextCycle`

**Where:** [src/app/actions/subscriptions.ts:303](../src/app/actions/subscriptions.ts:303)

**Problem.** Reads `next_ship_date` + `skipped_cycle_count`, computes new values, writes with only `status='active'` filter. Two concurrent skips can both succeed but only advance one cadence and only increment counter once. Or send two "skipped" lifecycle emails for one logical state change.

**Fix:** add compare-and-swap filters to the UPDATE: `.eq("next_ship_date", oldDateString).eq("skipped_cycle_count", oldCount)`. Then check `.select()` rowcount — if 0, another skip won the race and ours rolls back. Or move into a row-locked RPC if you want it bulletproof.

---

## 4. (MEDIUM) W9 supersession not DB-enforced

**Where:** [src/app/actions/affiliate-portal.ts:370](../src/app/actions/affiliate-portal.ts:370) + [supabase/migrations/0022_affiliate_portal.sql:48](../supabase/migrations/0022_affiliate_portal.sql:48)

**Problem.** Two concurrent W9 uploads can each end up with `superseded_at IS NULL` rows, OR if the final insert fails, the prior current row may already be marked superseded AND its file may already be deleted. There's no DB constraint preventing multiple "current" W9s per affiliate.

**Fix:**
1. Migration: add a partial unique index — `CREATE UNIQUE INDEX affiliate_w9_one_active_per_user ON public.affiliate_w9 (affiliate_user_id) WHERE superseded_at IS NULL;`
2. In the upload action: do supersession + insert in a transactional RPC, only delete the prior storage object AFTER the new ledger row is durable.

---

## 5. (Operational) Storage bucket `affiliate-w9` must be created manually

**Where:** Supabase dashboard → Storage → buckets

**Steps** (per [docs/AFFILIATE-PORTAL-MANUAL.md](AFFILIATE-PORTAL-MANUAL.md)):
1. Create new bucket named `affiliate-w9`.
2. Set it as **PRIVATE** (NOT public).
3. The RLS policies on `storage.objects` were already applied via migration 0022 (auth.uid owner-only SELECT/INSERT, service-role unrestricted SELECT).
4. Verify by attempting to fetch a known W9 path via the public URL — must return 4xx.

---

## 6. (Operational) Run codex review pass 2 fixes verification end-to-end

After deploy:
- Place a real test order with FIRST250 at $300 subtotal. Confirm the persisted `total_cents` is exactly `30000 - 4000 = 26000` (10% off first $250 = $25, plus 30% off the $50 above = $15, total $40 off).
- Place a test order with FOUNDER + 2 vials. Confirm the order persists at full price (no discount; coupon redemption row deleted).
- Hit `/api/analytics` with a deliberate 12KB `properties` payload. Confirm only the first ~8KB worth lands in the events table.

---

## 7. (Pre-launch ops) Items from the LAUNCH-CHECKLIST that need YOU

Already documented separately in [docs/LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md). The high-impact ones:
1. Vercel env vars audit — change `ADMIN_PASSWORD` from the dev placeholder.
2. Resend domain verification (DKIM + SPF on benchgradepeptides.com).
3. DNS pointing at Vercel + SSL cert provisioned.
4. Smoke order: cart → 4-step checkout → submit → confirm all 4 transactional emails arrive in a real inbox.

---

## 8. (Tech debt — not blocking) Two-pass codex notes preserved

Pass 1 found 6 issues, all fixed in commit `11d1e41`. Pass 2 found 7 more — 3 fixed in this session (the ones in this commit), 4 documented above as #1-#4 for follow-up. Keep both codex transcripts in your records if you want to delegate the follow-ups.
