-- 0012_nowpayments_invoice_and_funded_at.sql
--
-- Captures schema changes already applied directly via Supabase MCP and
-- adds new columns surfaced by the launch-readiness audit. Idempotent
-- (`IF NOT EXISTS`) so a fresh deploy and an already-migrated DB both
-- converge on the same shape.
--
-- 1. nowpayments_invoice_id / nowpayments_invoice_url — persist the
--    NOWPayments hosted-invoice details so the IPN webhook can bind
--    incoming payments to the originating invoice and so the customer
--    portal at /account/orders/[id] can surface the payment URL.
--
-- 2. nowpayments_payment_id — added later in the same migration set so
--    the IPN handler can confirm that an inbound webhook references the
--    same payment we created (defense against replayed/forged IPNs that
--    happen to share an order_id).
--
-- 3. funded_at — discrete timestamp for the awaiting_payment → funded
--    transition. Earlier code used `updated_at` as a stand-in; that
--    drifts on any later mutation (admin note add, etc.) and breaks
--    the customer portal's status timeline. Backfill from updated_at
--    where status has already advanced past awaiting_payment.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS nowpayments_invoice_id  TEXT,
  ADD COLUMN IF NOT EXISTS nowpayments_invoice_url TEXT,
  ADD COLUMN IF NOT EXISTS nowpayments_payment_id  TEXT,
  ADD COLUMN IF NOT EXISTS funded_at               TIMESTAMPTZ;

COMMENT ON COLUMN public.orders.nowpayments_invoice_id IS
  'NOWPayments invoice id returned from POST /v1/invoice. Persisted so the IPN handler can bind incoming webhooks to the originating invoice instead of just the order_id.';
COMMENT ON COLUMN public.orders.nowpayments_invoice_url IS
  'Hosted payment URL the customer follows to send crypto. Emailed to the customer after order submission.';
COMMENT ON COLUMN public.orders.nowpayments_payment_id IS
  'NOWPayments payment_id set on the IPN. Cross-checked against the invoice on subsequent IPNs to refuse replayed/forged webhooks.';
COMMENT ON COLUMN public.orders.funded_at IS
  'Discrete timestamp of the awaiting_payment → funded transition. Set by markOrderFunded and the NOWPayments IPN handler.';

-- Backfill funded_at for orders that already advanced past awaiting_payment
-- before this column existed. updated_at is the best stand-in we have.
UPDATE public.orders
SET funded_at = updated_at
WHERE funded_at IS NULL
  AND status IN ('funded', 'shipped', 'refunded');
