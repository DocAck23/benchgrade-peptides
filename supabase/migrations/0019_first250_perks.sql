-- 0019_first250_perks.sql
--
-- Mirrors the live MCP-applied DDL. Replaces FIRST100 with the
-- FIRST250 launch cohort and adds the lifetime-free-shipping ledger
-- table that the cohort qualifies into.
--
-- Tier logic lives in submitOrder application code:
--   • Baseline 10% off (single percent on the coupon row)
--   • If subtotal >= $250 → bump effective discount to 30%
--   • If subscription_mode is prepay 3 months → override to 18%
--   • If subscription_mode is prepay 6 months → override to 25%
--   • If subtotal >= $500 → free vial of customer's choice
--   • All cohort members → lifetime free shipping (this table)
--   • Refer someone who spends $250+ → $25 in-store credit (separate
--     ledger system, deferred — see /memory/feedback_build_workflow)

DELETE FROM public.coupons WHERE code = 'first100';

INSERT INTO public.coupons (
  code, percent_off, flat_off_cents, min_subtotal_cents,
  valid_from, valid_until, max_redemptions, max_per_email, note
)
VALUES (
  'first250', 10, NULL, 0,
  NULL, NULL, 250, 1,
  'First-250 launch cohort. Baseline 10%; tier bumps to 30% at $250, 18% on 3-month prepay sub, 25% on 6-month prepay sub. Free vial at $500. Lifetime free shipping for cohort members. $25 referral credit on referee $250+ order.'
)
ON CONFLICT (code) DO UPDATE SET
  percent_off = EXCLUDED.percent_off,
  max_redemptions = EXCLUDED.max_redemptions,
  max_per_email = EXCLUDED.max_per_email,
  note = EXCLUDED.note;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS first_250_member BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.lifetime_free_shipping (
  email_lower TEXT PRIMARY KEY,
  qualified_via TEXT NOT NULL,
  qualified_order_id UUID REFERENCES public.orders(order_id) ON DELETE SET NULL,
  qualified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.lifetime_free_shipping IS
  'Email_lower → permanent free-shipping perk. Populated when a customer redeems a cohort coupon (FIRST250). Honored by checkout regardless of cart subtotal.';
COMMENT ON COLUMN public.orders.first_250_member IS
  'TRUE iff this is the order that earned the customer first-250 cohort status.';
