-- 0015_coupon_atomic_redeem.sql
--
-- - Lowercase enforcement on coupon codes (codex P1).
-- - Atomic redeem_coupon RPC: row-locks the coupon, re-checks
--   validity + caps + best-of vs existing discount inside one
--   transaction, inserts the redemption, and updates the order
--   totals — all-or-nothing. Mirrors the live MCP-applied DDL.

UPDATE public.coupons SET code = lower(code) WHERE code <> lower(code);

ALTER TABLE public.coupons
  DROP CONSTRAINT IF EXISTS coupons_code_lowercase;
ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_code_lowercase CHECK (code = lower(code));

CREATE OR REPLACE FUNCTION public.redeem_coupon(
  p_code TEXT,
  p_order_id UUID,
  p_customer_email_lower TEXT
) RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_coupon public.coupons;
  v_global_count INT;
  v_per_email_count INT;
  v_subtotal INT;
  v_discount_existing INT;
  v_coupon_discount INT;
  v_applied INT;
BEGIN
  SELECT * INTO v_coupon FROM public.coupons WHERE code = lower(p_code) FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_coupon.valid_from IS NOT NULL AND now() < v_coupon.valid_from THEN RETURN NULL; END IF;
  IF v_coupon.valid_until IS NOT NULL AND now() > v_coupon.valid_until THEN RETURN NULL; END IF;

  SELECT subtotal_cents, COALESCE(discount_cents, 0)
    INTO v_subtotal, v_discount_existing
    FROM public.orders
    WHERE order_id = p_order_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_subtotal < v_coupon.min_subtotal_cents THEN RETURN NULL; END IF;

  SELECT COUNT(*) INTO v_global_count
    FROM public.coupon_redemptions
    WHERE coupon_code = v_coupon.code;
  IF v_coupon.max_redemptions IS NOT NULL
     AND v_global_count >= v_coupon.max_redemptions THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*) INTO v_per_email_count
    FROM public.coupon_redemptions
    WHERE coupon_code = v_coupon.code
      AND customer_email_lower = lower(p_customer_email_lower);
  IF v_per_email_count >= v_coupon.max_per_email THEN RETURN NULL; END IF;

  IF v_coupon.percent_off IS NOT NULL THEN
    v_coupon_discount := round(v_subtotal::numeric * v_coupon.percent_off / 100);
  ELSE
    v_coupon_discount := LEAST(v_subtotal, v_coupon.flat_off_cents);
  END IF;

  IF v_coupon_discount <= v_discount_existing THEN RETURN NULL; END IF;
  v_applied := v_coupon_discount;

  INSERT INTO public.coupon_redemptions (
    coupon_code, order_id, customer_email_lower, discount_cents_applied
  ) VALUES (
    v_coupon.code, p_order_id, lower(p_customer_email_lower), v_applied
  );

  UPDATE public.orders
    SET discount_cents = v_applied,
        total_cents = GREATEST(0, v_subtotal - v_applied)
    WHERE order_id = p_order_id;

  RETURN v_applied;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_coupon(TEXT, UUID, TEXT) TO service_role;
