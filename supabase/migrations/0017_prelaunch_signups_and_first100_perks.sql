-- 0017_prelaunch_signups_and_first100_perks.sql
--
-- Mirrors the live DDL applied via Supabase MCP for the pre-launch
-- waitlist + the FIRST100 coupon's conditional perks (free vial of
-- choice + entry into the $500 launch giveaway when paired with a
-- prepay subscription).

CREATE TABLE IF NOT EXISTS public.prelaunch_signups (
  email_lower TEXT PRIMARY KEY,
  signed_up_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip TEXT,
  user_agent TEXT,
  welcome_sent_at TIMESTAMPTZ,
  first_order_id UUID REFERENCES public.orders(order_id) ON DELETE SET NULL,
  unsubscribed_at TIMESTAMPTZ
);

COMMENT ON TABLE public.prelaunch_signups IS
  'Pre-launch email waitlist. One row per email_lower. Distinct from marketing_subscribers (post-purchase consent) — these signed up BEFORE the catalogue went live.';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS giveaway_entry BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS first_vial_free_sku TEXT;

COMMENT ON COLUMN public.orders.giveaway_entry IS
  'TRUE iff this order qualified for the launch $500-giveaway drawing (FIRST100 + prepay subscription).';
COMMENT ON COLUMN public.orders.first_vial_free_sku IS
  'Customer-chosen SKU that gets 100% off as the FIRST100+prepay perk. Null if the perk does not apply.';

INSERT INTO public.coupons (
  code, percent_off, flat_off_cents, min_subtotal_cents,
  valid_from, valid_until, max_redemptions, max_per_email, note
)
VALUES (
  'first100', 20, NULL, 0,
  NULL, NULL, 100, 1,
  'Pre-launch waitlist: 20% off + free shipping. Prepay-subscription orders also get a free vial of choice + entry into the $500 giveaway.'
)
ON CONFLICT (code) DO NOTHING;
