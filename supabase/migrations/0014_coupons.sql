-- 0014_coupons.sql
--
-- Coupon engine. Mirrors the live MCP-applied DDL.
-- Stacking rule: coupon NEVER stacks with Stack & Save / referral /
-- same-SKU / affiliate / subscription — at apply time the engine
-- compares the coupon's value to the already-discounted total and
-- picks the lower of the two.

CREATE TABLE IF NOT EXISTS public.coupons (
  code TEXT PRIMARY KEY,
  percent_off INT,
  flat_off_cents INT,
  CONSTRAINT coupon_one_of_amount CHECK (
    (percent_off IS NOT NULL AND flat_off_cents IS NULL AND percent_off BETWEEN 1 AND 100)
    OR (flat_off_cents IS NOT NULL AND percent_off IS NULL AND flat_off_cents > 0)
  ),
  min_subtotal_cents INT NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  max_redemptions INT,
  max_per_email INT NOT NULL DEFAULT 1,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_code TEXT NOT NULL REFERENCES public.coupons(code) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(order_id) ON DELETE CASCADE,
  customer_email_lower TEXT NOT NULL,
  discount_cents_applied INT NOT NULL,
  redeemed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coupon_code, order_id)
);

CREATE INDEX IF NOT EXISTS coupon_redemptions_code_email_idx
  ON public.coupon_redemptions(coupon_code, customer_email_lower);
