"use client";

import { useCart } from "@/lib/cart/CartContext";
import { computeCartTotalsForCheckout, type SubscriptionModeForCart } from "@/lib/cart/discounts";
import { subscriptionDiscountPercent } from "@/lib/subscriptions/discounts";
import { formatPrice, cn } from "@/lib/utils";

type PlanDuration = SubscriptionModeForCart["duration_months"];
type PaymentCadence = SubscriptionModeForCart["payment_cadence"];

const ALL_DURATIONS: PlanDuration[] = [3, 6, 12];

const DEFAULT_MODE: SubscriptionModeForCart = {
  duration_months: 6,
  payment_cadence: "prepay",
  // Prepay is always a single bulk shipment (N× cart qty in one box).
  // Bill-monthly ships one box per paid cycle. The ship_cadence field
  // is preserved on the type for downstream wiring but hidden from UI.
  ship_cadence: "once",
};

/**
 * SubscriptionUpsellCard — Wave B2 checkout upsell. Reads cart state via
 * `useCart()`. UI only: server wiring (orders.ts) is Wave C's job.
 *
 * Layout (per spec §16.4):
 *   - eyebrow + headline
 *   - Prepay/Bill-pay toggle (top)
 *   - 5 duration buttons (1mo grayed in bill-pay)
 *   - 3 ship-cadence options (Once grayed in bill-pay)
 *   - live total preview when subscriptionMode is set
 *   - "Subscribe to this stack" persistent toggle at bottom
 */
export function SubscriptionUpsellCard() {
  const { items, subscriptionMode, setSubscriptionMode } = useCart();

  if (items.length === 0) return null;

  // Working draft — when subscribe toggle is off, we still show the user
  // their last selection (or the default) so they can preview deals before
  // committing. Reads as the active mode if set, falls back to default.
  const draft: SubscriptionModeForCart = subscriptionMode ?? DEFAULT_MODE;
  const isActive = subscriptionMode !== null;

  const setMode = (next: SubscriptionModeForCart) => {
    // Coerce ship_cadence to match payment cadence:
    //   prepay     → ship_once (bulk N× shipment)
    //   bill_pay   → ship monthly (one box per paid cycle)
    const m: SubscriptionModeForCart = {
      ...next,
      ship_cadence: next.payment_cadence === "prepay" ? "once" : "monthly",
    };
    setSubscriptionMode(m);
  };

  const onCadence = (cadence: PaymentCadence) => {
    setMode({ ...draft, payment_cadence: cadence });
  };

  const onDuration = (duration: PlanDuration) => {
    setMode({ ...draft, duration_months: duration });
  };

  const onToggleSubscribe = () => {
    if (isActive) {
      setSubscriptionMode(null);
    } else {
      setSubscriptionMode(draft);
    }
  };

  // Pricing preview — derived against the draft so the customer can see the
  // savings before committing the toggle.
  const previewTotals = computeCartTotalsForCheckout(items, draft);

  const isPrepay = draft.payment_cadence === "prepay";

  return (
    <section
      className="border rule bg-paper-soft p-5 space-y-4"
      aria-labelledby="subscription-upsell-heading"
    >
      <header className="space-y-1">
        <div className="label-eyebrow text-gold-dark">SUBSCRIBE &amp; SAVE MORE</div>
        <h2
          id="subscription-upsell-heading"
          className="font-display italic text-2xl text-ink leading-tight"
        >
          Lock in this stack and save more.
        </h2>
      </header>

      {/* Prepay / Bill-pay toggle */}
      <div
        className="grid grid-cols-2 border rule overflow-hidden"
        role="group"
        aria-label="Payment cadence"
      >
        {(["prepay", "bill_pay"] as const).map((cadence) => {
          const selected = draft.payment_cadence === cadence;
          return (
            <button
              key={cadence}
              type="button"
              data-cadence={cadence}
              aria-pressed={selected}
              onClick={() => onCadence(cadence)}
              className={cn(
                "h-10 text-xs tracking-[0.04em] uppercase transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                selected ? "bg-ink text-paper" : "bg-paper text-ink-soft hover:bg-paper-soft",
              )}
            >
              {cadence === "prepay" ? "Prepay" : "Bill monthly"}
            </button>
          );
        })}
      </div>

      {/* Duration row */}
      <div>
        <div className="label-eyebrow text-ink-muted mb-2">Plan length</div>
        <div
          role="radiogroup"
          aria-label="Plan duration"
          className="grid grid-cols-3 gap-1.5"
        >
          {ALL_DURATIONS.map((d) => {
            const selected = draft.duration_months === d;
            const previewPct = subscriptionDiscountPercent({
              duration_months: d,
              payment_cadence: draft.payment_cadence,
              ship_cadence: isPrepay ? "once" : "monthly",
            });
            return (
              <button
                key={d}
                type="button"
                data-duration={d}
                role="radio"
                aria-checked={selected}
                onClick={() => onDuration(d)}
                className={cn(
                  "flex flex-col items-center justify-center h-14 border rule text-xs transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                  selected
                    ? "bg-wine text-paper border-wine"
                    : "bg-paper text-ink hover:bg-paper-soft",
                )}
              >
                <span className="font-medium">{`${d} mo`}</span>
                {previewPct > 0 && (
                  <span
                    className={cn(
                      "text-[10px] mt-0.5",
                      selected ? "text-paper/80" : "text-gold-dark",
                    )}
                  >
                    −{previewPct}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode summary — what this plan actually does */}
      <div className="border rule bg-paper px-3 py-2 text-[11px] text-ink-soft leading-relaxed">
        {isPrepay ? (
          <>
            <strong className="font-display text-ink">Prepay · one bulk shipment.</strong>{" "}
            Pay once today, ship {draft.duration_months}× your cart in a single
            box right away. Renews after {draft.duration_months} months.
          </>
        ) : (
          <>
            <strong className="font-display text-ink">Bill monthly · one box per payment.</strong>{" "}
            Each month we email a payment reminder. After you pay, that month&rsquo;s
            box ships. 5-day grace per missed payment, then auto-cancel.
          </>
        )}
      </div>

      {/* Live total preview */}
      {previewTotals.subscription_discount_percent > 0 && (
        <div
          aria-live="polite"
          className="border-t rule pt-3 flex items-baseline justify-between"
        >
          <div className="text-xs text-ink-soft">
            <span className="font-mono-data text-base text-wine">
              {formatPrice(
                isPrepay
                  ? previewTotals.total_cents * draft.duration_months
                  : previewTotals.total_cents,
              )}
            </span>{" "}
            {isPrepay ? "today" : `/month × ${draft.duration_months}`}
          </div>
          <div className="text-xs text-gold-dark">
            saves{" "}
            <span className="font-mono-data">
              {formatPrice(
                (previewTotals.subscription_discount_cents +
                  previewTotals.same_sku_discount_cents) *
                  (isPrepay ? draft.duration_months : 1),
              )}
            </span>{" "}
            vs retail
          </div>
        </div>
      )}

      {/* Subscribe toggle */}
      <button
        type="button"
        data-testid="subscribe-toggle"
        aria-pressed={isActive}
        onClick={onToggleSubscribe}
        className={cn(
          "w-full h-11 border rule text-xs tracking-[0.04em] uppercase transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
          isActive
            ? "bg-gold-dark text-paper border-gold-dark"
            : "bg-paper text-ink hover:bg-paper-soft",
        )}
      >
        {isActive ? "Subscribed to this stack ✓" : "Subscribe to this stack"}
      </button>
    </section>
  );
}

export default SubscriptionUpsellCard;
