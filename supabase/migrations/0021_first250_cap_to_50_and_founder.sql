-- 0021_first250_cap_to_50_and_founder.sql
--
-- Mirrors the live MCP-applied DDL.
--
-- Two changes:
--
--   1. FIRST250's actual cap drops from 250 → 50. The marketing
--      surface still says "first 250" — a deliberate scarcity floor
--      so the FOUNDER fallback fires sooner.
--
--   2. New FOUNDER coupon. Surfaced as the friendly fallback when
--      FIRST250 is exhausted at checkout. Application-layer rules
--      (enforced in submitOrder, since the coupons schema only
--      carries percent_off + min_subtotal_cents):
--        • 25% off, gated on cart having 3+ peptide vials.
--        • Subtotal >= $500  → 1 free vial of customer's choice
--        • Subtotal >= $1000 → 2 free vials of customer's choice
--      One redemption per email; no global cap.

UPDATE public.coupons
SET max_redemptions = 50,
    note = 'First-50 launch cohort (advertised as 250). Baseline 10%; tier bumps to 30% at $250, 18% on 3-month prepay sub, 25% on 6-month prepay sub. Free vial at $500. Lifetime free shipping for cohort members.'
WHERE code = 'first250';

INSERT INTO public.coupons (
  code, percent_off, flat_off_cents, min_subtotal_cents,
  valid_from, valid_until, max_redemptions, max_per_email, note
)
VALUES (
  'founder', 25, NULL, 0,
  NULL, NULL, NULL, 1,
  'Founder thank-you. 25% off when stacking 3+ vials. Free vial at $500, two free vials at $1000. One redemption per email.'
)
ON CONFLICT (code) DO UPDATE SET
  percent_off = EXCLUDED.percent_off,
  max_redemptions = EXCLUDED.max_redemptions,
  max_per_email = EXCLUDED.max_per_email,
  note = EXCLUDED.note;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS free_vial_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.orders.free_vial_count IS
  'How many free vials this order earned via promo perks (FIRST250 $500+, FOUNDER $500+/$1000+). first_vial_free_sku names the customer-chosen SKU.';
