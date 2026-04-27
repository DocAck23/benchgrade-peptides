-- 0016_analytics_events.sql
--
-- First-party analytics. We don't ship a third-party tracker (Plausible,
-- PostHog, GA) so traffic + funnel data stays inside our own Supabase —
-- the same place revenue lives. The admin dashboard joins these against
-- `orders` to compute true conversion rate, AOV per source, etc.
--
-- Two tables:
--
--   analytics_sessions  — one row per visitor session (UA, country, source,
--                         landing page, referrer, first/last seen).
--   analytics_events    — one row per discrete event (pageview, cart add,
--                         checkout step, order submit). Foreign-keyed to
--                         the session so we can reconstruct any user's
--                         path.
--
-- Sessions are keyed by an opaque `session_id` (uuid) the client beacon
-- sets in a first-party cookie with a 30-min idle expiry. We do NOT
-- correlate to auth.uid here — that join happens at query time in the
-- dashboard via order email matching.

CREATE TABLE IF NOT EXISTS public.analytics_sessions (
  session_id UUID PRIMARY KEY,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Country resolved via the Vercel x-vercel-ip-country header (free,
  -- already on the request). `null` outside Vercel / in dev.
  country TEXT,
  -- Source attribution: utm_source / utm_medium / utm_campaign
  -- captured on the first pageview of the session. Frozen — even if
  -- the user navigates with new utm params later we keep the original.
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_content TEXT,
  utm_term TEXT,
  -- Document.referrer at session start (or null for direct).
  referrer TEXT,
  -- Where they entered the site.
  landing_path TEXT,
  -- Lightweight UA classification. Full UA stored on first event for
  -- forensics; this column is the bucketed value used in dashboards.
  device_class TEXT CHECK (device_class IN ('mobile', 'tablet', 'desktop', 'bot', 'unknown')),
  user_agent TEXT,
  -- Email captured at checkout — lets us correlate session → order
  -- without joining JSON. Set on `order_submitted` event.
  customer_email_lower TEXT
);

CREATE INDEX IF NOT EXISTS analytics_sessions_first_seen_idx
  ON public.analytics_sessions (first_seen_at DESC);
CREATE INDEX IF NOT EXISTS analytics_sessions_email_idx
  ON public.analytics_sessions (customer_email_lower)
  WHERE customer_email_lower IS NOT NULL;
CREATE INDEX IF NOT EXISTS analytics_sessions_utm_source_idx
  ON public.analytics_sessions (utm_source)
  WHERE utm_source IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.analytics_sessions(session_id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Constrained to the events the dashboard actually understands.
  -- Adding a new event = a one-line migration alter, not a free-for-all.
  event_name TEXT NOT NULL CHECK (event_name IN (
    'pageview',
    'product_view',
    'add_to_cart',
    'remove_from_cart',
    'checkout_start',
    'checkout_step',
    'coupon_attempt',
    'order_submitted',
    'order_funded',
    'subscription_started',
    'affiliate_click',
    'referral_click',
    'coa_request',
    'newsletter_signup'
  )),
  -- Path of the page when the event fired (ie /catalogue/metabolic).
  path TEXT,
  -- Free-form JSON for event-specific properties. Examples:
  --   pageview:        { title }
  --   product_view:    { sku, product_slug }
  --   add_to_cart:     { sku, quantity, unit_price_cents }
  --   checkout_step:   { step: 1|2|3|4 }
  --   coupon_attempt:  { code, result: 'applied' | 'invalid' | 'bestof_loses' }
  --   order_submitted: { order_id, total_cents }
  properties JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS analytics_events_session_idx
  ON public.analytics_events (session_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_name_time_idx
  ON public.analytics_events (event_name, occurred_at DESC);
CREATE INDEX IF NOT EXISTS analytics_events_occurred_idx
  ON public.analytics_events (occurred_at DESC);

-- Daily-rollup view used by the admin dashboard. Materializes nothing
-- — recomputed on each query — but the indexes above make this fast
-- through 10M events.
CREATE OR REPLACE VIEW public.analytics_daily AS
SELECT
  date_trunc('day', occurred_at) AS day,
  event_name,
  count(*) AS event_count,
  count(DISTINCT session_id) AS unique_sessions
FROM public.analytics_events
GROUP BY 1, 2;

COMMENT ON TABLE public.analytics_events IS
  'First-party event stream. Append-only; never delete rows (use the analytics_events_occurred_idx for time-bound queries instead).';
