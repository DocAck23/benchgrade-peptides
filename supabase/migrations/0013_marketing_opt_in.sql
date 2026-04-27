-- 0013_marketing_opt_in.sql
--
-- Marketing-email opt-in tracking. See migration applied via Supabase
-- MCP for the live DDL; this file mirrors it so a fresh deploy
-- converges on the same shape.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.orders.marketing_opt_in IS
  'Per-order marketing-email consent record. Default true; customer can untick at checkout. Unsubscribes are tracked in marketing_subscribers.';

CREATE TABLE IF NOT EXISTS public.marketing_subscribers (
  email_lower TEXT PRIMARY KEY,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMPTZ,
  source_order_id UUID REFERENCES public.orders(order_id) ON DELETE SET NULL
);

COMMENT ON TABLE public.marketing_subscribers IS
  'Per-email subscription state. email_lower keeps the table case-insensitive. unsubscribed_at NULL = currently subscribed.';

INSERT INTO public.marketing_subscribers (email_lower, source_order_id)
SELECT DISTINCT ON (lower(customer->>'email'))
  lower(customer->>'email') AS email_lower,
  order_id
FROM public.orders
WHERE customer->>'email' IS NOT NULL
ON CONFLICT (email_lower) DO NOTHING;
