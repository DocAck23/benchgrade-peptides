"use client";

import { useCart } from "@/lib/cart/CartContext";
import { computeCartTotalsForCheckout, type SubscriptionModeForCart } from "@/lib/cart/discounts";
import { subscriptionDiscountPercent } from "@/lib/subscriptions/discounts";
import { formatPrice, cn } from "@/lib/utils";

type PlanDuration = SubscriptionModeForCart["duration_months"];
type PaymentCadence = SubscriptionModeForCart["payment_cadence"];
type ShipCadence = SubscriptionModeForCart["ship_cadence"];

const ALL_DURATIONS: PlanDuration[] = [1, 3, 6, 9, 12];

const SHIP_OPTIONS: { value: ShipCadence; label: string; sub?: string }[] = [
  { value: "monthly", label: "Monthly", sub: "default" },
  { value: "quarterly", label: "Quarterly" },
  { value: "once", label: "Ship once", sub: "+3% bonus" },
];

const DEFAULT_MODE: SubscriptionModeForCart = {
  duration_months: 6,
  payment_cadence: "prepay",
  ship_cadence: "monthly",
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
    // Coerce invalid combos forward when toggling.
    let m = { ...next };
    if (m.payment_cadence === "bill_pay") {
      if (m.duration_months === 1) m.duration_months = 3;
      if (m.ship_cadence === "once") m.ship_cadence = "monthly";
    }
    setSubscriptionMode(m);
  };

  const onCadence = (cadence: PaymentCadence) => {
    setMode({ ...draft, payment_cadence: cadence });
  };

  const onDuration = (duration: PlanDuration) => {
    setMode({ ...draft, duration_months: duration });
  };

  const onShip = (ship: ShipCadence) => {
    setMode({ ...draft, ship_cadence: ship });
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
          className="grid grid-cols-5 gap-1.5"
        >
          {ALL_DURATIONS.map((d) => {
            const disabled = !isPrepay && d === 1;
            const selected = draft.duration_months === d && !disabled;
            // Show discount for this duration in current cadence
            const previewPct = subscriptionDiscountPercent({
              duration_months: d,
              payment_cadence: draft.payment_cadence,
              ship_cadence: isPrepay ? draft.ship_cadence : "monthly",
            });
            return (
              <button
                key={d}
                type="button"
                data-duration={d}
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => !disabled && onDuration(d)}
                className={cn(
                  "flex flex-col items-center justify-center h-14 border rule text-xs transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                  selected
                    ? "bg-wine text-paper border-wine"
                    : disabled
                      ? "bg-paper text-ink-muted/50 cursor-not-allowed opacity-50"
                      : "bg-paper text-ink hover:bg-paper-soft",
                )}
              >
                <span className="font-medium">
                  {disabled ? "N/A" : `${d} mo`}
                </span>
                {!disabled && previewPct > 0 && (
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

      {/* Ship cadence row */}
      <div>
        <div className="label-eyebrow text-ink-muted mb-2">Shipping cadence</div>
        <div
          role="radiogroup"
          aria-label="Shipping cadence"
          className="grid grid-cols-3 gap-1.5"
        >
          {SHIP_OPTIONS.map((opt) => {
            const disabled = !isPrepay && opt.value === "once";
            const selected = draft.ship_cadence === opt.value && !disabled;
            return (
              <button
                key={opt.value}
                type="button"
                data-ship={opt.value}
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => !disabled && onShip(opt.value)}
                className={cn(
                  "flex flex-col items-center justify-center h-12 border rule text-xs transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                  selected
                    ? "bg-ink text-paper border-ink"
                    : disabled
                      ? "bg-paper text-ink-muted/50 cursor-not-allowed opacity-50"
                      : "bg-paper text-ink hover:bg-paper-soft",
                )}
              >
                <span>{opt.label}</span>
                {opt.sub && (
                  <span
                    className={cn(
                      "text-[10px] mt-0.5",
                      selected ? "text-paper/80" : "text-ink-muted",
                    )}
                  >
                    {opt.sub}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live total preview */}
      {previewTotals.subscription_discount_percent > 0 && (
        <div
          aria-live="polite"
          className="border-t rule pt-3 flex items-baseline justify-between"
        >
          <div className="text-xs text-ink-soft">
            <span className="font-mono-data text-base text-wine">
              {formatPrice(previewTotals.total_cents)}
            </span>{" "}
            today
          </div>
          <div className="text-xs text-gold-dark">
            saves{" "}
            <span className="font-mono-data">
              {formatPrice(
                previewTotals.subscription_discount_cents + previewTotals.same_sku_discount_cents,
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
