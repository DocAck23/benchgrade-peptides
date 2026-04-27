-- 0018_subscription_skip_and_cancel_reason.sql
--
-- Mirrors the live MCP-applied DDL for the customer-facing subscription
-- self-service additions:
--
--   • cancellation_reason — optional free-text the customer enters in
--     the cancel-confirm dialog. Null when they skipped the textarea.
--     Used for retention analytics, not surfaced back to the customer.
--
--   • skipped_cycle_count — running total of one-off cycle skips. The
--     "skip next cycle" button bumps `next_ship_date` forward and
--     increments this counter so we can later surface "how many skips
--     this customer has banked / used" if we add a cap.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS skipped_cycle_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.subscriptions.cancellation_reason IS
  'Free-text capture from the cancel confirm dialog. Optional — null if customer skipped it.';
COMMENT ON COLUMN public.subscriptions.skipped_cycle_count IS
  'Total cycles the customer manually skipped (one-off, distinct from a full pause).';
