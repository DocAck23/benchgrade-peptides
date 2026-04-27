-- 0020_orders_session_id.sql
--
-- Capture which analytics_session this order came from. Lets the
-- analytics dashboard attribute revenue to a single source bucket
-- (utm/referrer/direct) without the email-set membership double-
-- count the prior implementation had — codex review #6.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS session_id UUID
    REFERENCES public.analytics_sessions(session_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS orders_session_id_idx
  ON public.orders (session_id) WHERE session_id IS NOT NULL;

COMMENT ON COLUMN public.orders.session_id IS
  'The bgp_sess cookie value at the moment this order was submitted. Joins one-to-one to analytics_sessions for source attribution.';
