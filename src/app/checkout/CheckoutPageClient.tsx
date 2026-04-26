"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flag, ShieldCheck, QrCode, Snowflake, Check } from "lucide-react";
import { useCart } from "@/lib/cart/CartContext";
import { RUOGate, type RUOAcknowledgmentPayload } from "@/components/compliance/RUOGate";
import { submitOrder, type CustomerInfo } from "@/app/actions/orders";
import { formatPrice, cn } from "@/lib/utils";
import { Callout } from "@/components/ui";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/site";
import { CardProcessorFootnote } from "@/components/checkout/CardProcessorFootnote";
import { SubscriptionUpsellCard } from "@/components/checkout/SubscriptionUpsellCard";
import { parseReferralCookie } from "@/lib/referrals/cookie";
import {
  type PaymentMethod,
  paymentMethodLabel,
  paymentMethodBlurb,
} from "@/lib/payments/methods";
import {
  personalVialDiscount,
  type AffiliateTier,
} from "@/lib/affiliate/tiers";

const EMPTY: CustomerInfo = {
  name: "",
  email: "",
  institution: "",
  phone: "",
  ship_address_1: "",
  ship_address_2: "",
  ship_city: "",
  ship_state: "",
  ship_zip: "",
  notes: "",
};

interface CheckoutPageClientProps {
  /** Methods the server has confirmed are configured + available. */
  availableMethods: PaymentMethod[];
  /**
   * Affiliate state for the current viewer, resolved server-side. When set,
   * we surface a "personal discount" preview line in the summary aside
   * (Sprint 4 Wave C). The actual discount is applied authoritatively in
   * `submitOrder` — this prop is COSMETIC.
   */
  affiliate?: { tier: AffiliateTier } | null;
}

export function CheckoutPageClient({
  availableMethods,
  affiliate = null,
}: CheckoutPageClientProps) {
  const router = useRouter();
  const { items, subtotal, itemCount, totals, subscriptionMode, clear } = useCart();
  const hasStackSave = totals.stack_save_discount_cents > 0;
  const hasSameSku = totals.same_sku_discount_cents > 0;
  const hasAnyDiscount = hasStackSave || hasSameSku;
  const [form, setForm] = useState<CustomerInfo>(EMPTY);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(
    availableMethods[0] ?? ""
  );
  const [ruoOpen, setRuoOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sprint 3 Wave C — referral discount preview line.
  //
  // Cosmetic only: we read `bgp_ref` from `document.cookie` to show a "10% off"
  // line above the Stack & Save / Subscription discounts. The cookie is
  // HttpOnly in production, so this preview will only render when a non-
  // HttpOnly mirror is set (e.g., dev/test). The authoritative discount is
  // applied server-side in `submitOrder` based on the request cookie + the
  // first-time-buyer check; we deliberately do NOT try to validate that here.
  const [referralPreview, setReferralPreview] = useState<{
    code: string;
    discountCents: number;
  } | null>(null);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const attribution = parseReferralCookie(document.cookie);
    if (!attribution) {
      setReferralPreview(null);
      return;
    }
    const discountCents = Math.round(subtotal * 100 * 0.1);
    setReferralPreview({ code: attribution.code, discountCents });
  }, [subtotal]);

  if (items.length === 0 && !submitting) {
    return (
      <article className="max-w-3xl mx-auto px-6 lg:px-10 py-20 text-center">
        <h1 className="font-display text-4xl text-ink mb-6">Your cart is empty.</h1>
        <Link
          href="/catalogue"
          className="inline-flex items-center h-12 px-8 bg-ink text-paper text-sm tracking-[0.04em] hover:bg-gold transition-colors"
        >
          Browse the catalogue
        </Link>
      </article>
    );
  }

  // Hard guard — the UI should never let them submit without a method,
  // but the server-side enum validation is the authoritative gate.
  if (availableMethods.length === 0) {
    return (
      <article className="max-w-3xl mx-auto px-6 lg:px-10 py-20 text-center">
        <h1 className="font-display text-3xl text-ink mb-4">Payments temporarily unavailable.</h1>
        <p className="text-ink-soft mb-6">
          No payment methods are currently configured on our end. Please email
          admin@benchgradepeptides.com to complete your order manually, or try again shortly.
        </p>
      </article>
    );
  }

  const update = <K extends keyof CustomerInfo>(key: K, value: CustomerInfo[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const onReview = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!paymentMethod) {
      setError("Please choose a payment method.");
      return;
    }
    setRuoOpen(true);
  };

  const inFlight = useRef(false);
  const onAcknowledge = async (ack: RUOAcknowledgmentPayload) => {
    if (inFlight.current) return;
    if (!paymentMethod) return;
    inFlight.current = true;
    setRuoOpen(false);
    setSubmitting(true);
    try {
      const res = await submitOrder({
        customer: form,
        items: items.map((i) => ({ sku: i.sku, quantity: i.quantity })),
        acknowledgment: {
          is_adult: ack.is_adult,
          is_researcher: ack.is_researcher,
          accepts_ruo: ack.accepts_ruo,
        },
        payment_method: paymentMethod,
        subscription_mode: subscriptionMode,
      });
      if (!res.ok) {
        setError(res.error ?? "Order submission failed.");
        setSubmitting(false);
        inFlight.current = false;
        return;
      }
      clear();
      router.push(`/checkout/success?id=${res.order_id ?? ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
      setSubmitting(false);
      inFlight.current = false;
    }
  };

  return (
    <article className="max-w-5xl mx-auto px-6 lg:px-10 py-12 lg:py-16">
      <div className="label-eyebrow text-ink-muted mb-4">Checkout</div>
      <h1 className="font-display text-4xl lg:text-5xl leading-tight text-ink mb-10">
        Complete your order.
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-10">
        <form onSubmit={onReview} className="space-y-10">
          <Section title="Contact">
            <Field label="Full name" required value={form.name} onChange={(v) => update("name", v)} autoComplete="name" />
            <Field label="Email" required type="email" value={form.email} onChange={(v) => update("email", v)} autoComplete="email" />
            <Field label="Phone" type="tel" value={form.phone} onChange={(v) => update("phone", v)} autoComplete="tel" />
            <Field label="Institution / lab" value={form.institution} onChange={(v) => update("institution", v)} autoComplete="organization" />
          </Section>

          <Section title="Shipping address">
            <Field label="Address line 1" required value={form.ship_address_1} onChange={(v) => update("ship_address_1", v)} autoComplete="address-line1" />
            <Field label="Address line 2" value={form.ship_address_2 ?? ""} onChange={(v) => update("ship_address_2", v)} autoComplete="address-line2" />
            <div className="grid grid-cols-2 gap-4">
              <Field label="City" required value={form.ship_city} onChange={(v) => update("ship_city", v)} autoComplete="address-level2" />
              <Field label="State" required value={form.ship_state} onChange={(v) => update("ship_state", v)} autoComplete="address-level1" />
            </div>
            <Field label="ZIP" required value={form.ship_zip} onChange={(v) => update("ship_zip", v)} autoComplete="postal-code" />
          </Section>

          <Section title="Payment method">
            <fieldset
              className="grid grid-cols-1 gap-2"
              role="radiogroup"
              aria-label="Payment method"
            >
              {availableMethods.map((m) => {
                const selected = paymentMethod === m;
                return (
                  <label
                    key={m}
                    className={cn(
                      "flex items-start gap-3 border rule p-3 cursor-pointer transition-colors",
                      selected ? "border-ink bg-paper-soft" : "bg-paper hover:bg-paper-soft"
                    )}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value={m}
                      checked={selected}
                      onChange={() => setPaymentMethod(m)}
                      className="mt-0.5 accent-ink"
                    />
                    <span className="flex-1">
                      <span className="block text-sm text-ink">{paymentMethodLabel(m)}</span>
                      <span className="block text-xs text-ink-muted mt-0.5">
                        {paymentMethodBlurb(m)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <CardProcessorFootnote />
          </Section>

          <Section title="Notes (optional)">
            <Field
              label="Anything the lab should know"
              value={form.notes ?? ""}
              onChange={(v) => update("notes", v)}
              multiline
            />
          </Section>

          <Callout variant="ruo" title="Payment on confirmation">
            No card processor. After you submit, we email you instructions for the method you chose.
            Your order ships within 1-2 business days of payment confirmation.
          </Callout>

          {error && (
            <div className="border border-danger/40 bg-danger/5 text-danger px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <TrustStrip />

          <button
            type="submit"
            disabled={submitting || !paymentMethod}
            className="flex items-center justify-center w-full h-12 bg-ink text-paper text-sm tracking-[0.04em] hover:bg-gold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting…" : "Review RUO certification & submit"}
          </button>

          <NextStepsTimeline />
        </form>

        <aside className="lg:sticky lg:top-8 h-fit border rule bg-paper-soft p-6 space-y-4">
          <div>
            <div className="label-eyebrow text-ink-muted mb-3">Order summary</div>
            <ul className="space-y-2 text-sm">
              {items.map((item) => (
                <li key={item.sku} className="flex justify-between gap-2">
                  <span className="truncate">
                    {item.name} · {item.pack_size}-vial pack × {item.quantity}
                  </span>
                  <span className="font-mono-data text-ink shrink-0">
                    {formatPrice(item.unit_price * item.quantity * 100)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <SubscriptionUpsellCard />
          <div className="border-t rule pt-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-xs label-eyebrow text-ink-muted">Subtotal</span>
              <span
                className={cn(
                  "font-mono-data text-sm",
                  hasAnyDiscount ? "text-ink-muted line-through" : "text-ink"
                )}
              >
                {formatPrice(subtotal * 100)}
              </span>
            </div>
            {referralPreview && (
              <div
                className="flex items-baseline justify-between"
                data-testid="referral-discount-preview"
              >
                <span
                  className="text-xs text-gold-dark italic"
                  style={{ fontFamily: "var(--font-editorial)" }}
                >
                  Referred by friend
                </span>
                <span className="font-mono-data text-sm text-gold-dark">
                  −{formatPrice(referralPreview.discountCents)}
                </span>
              </div>
            )}
            {affiliate && (
              <div
                className="flex items-baseline justify-between"
                data-testid="affiliate-discount-preview"
              >
                <span
                  className="text-xs text-gold-dark italic"
                  style={{ fontFamily: "var(--font-editorial)" }}
                >
                  Affiliate discount · {personalVialDiscount(affiliate.tier)}% off
                  <span className="text-ink-muted not-italic">
                    {" "}
                    (your tier:{" "}
                    {affiliate.tier.charAt(0).toUpperCase() +
                      affiliate.tier.slice(1)}
                    )
                  </span>
                </span>
                <span className="font-mono-data text-sm text-gold-dark">
                  −
                  {formatPrice(
                    Math.round(
                      subtotal * 100 * (personalVialDiscount(affiliate.tier) / 100)
                    )
                  )}
                </span>
              </div>
            )}
            {hasStackSave && (
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-gold-dark">
                  Stack &amp; Save · {totals.stack_save_tier_percent}% off
                </span>
                <span className="font-mono-data text-sm text-gold-dark">
                  −{formatPrice(totals.stack_save_discount_cents)}
                </span>
              </div>
            )}
            {hasSameSku && (
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-gold-dark">Same-SKU bonus · 5% off</span>
                <span className="font-mono-data text-sm text-gold-dark">
                  −{formatPrice(totals.same_sku_discount_cents)}
                </span>
              </div>
            )}
            {totals.free_shipping && (
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-gold-dark">Free domestic shipping</span>
                <span className="font-mono-data text-sm text-gold-dark">included</span>
              </div>
            )}
            <div className="flex items-baseline justify-between pt-2">
              <span className="text-sm text-ink-soft">
                {itemCount} {itemCount === 1 ? "vial" : "vials"}
              </span>
              <span className="font-mono-data text-lg text-wine">
                {formatPrice(totals.total_cents)}
              </span>
            </div>
          </div>
          <FreeShippingBar subtotal={subtotal} />
        </aside>
      </div>

      <RUOGate
        open={ruoOpen}
        onAcknowledge={onAcknowledge}
        onCancel={() => setRuoOpen(false)}
      />
    </article>
  );
}

function FreeShippingBar({ subtotal }: { subtotal: number }) {
  const remaining = Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0);
  const pct = Math.min((subtotal / FREE_SHIPPING_THRESHOLD) * 100, 100);
  const unlocked = remaining === 0 && subtotal > 0;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs">
        {unlocked ? (
          <>
            <Check className="w-3.5 h-3.5 text-gold" strokeWidth={2} aria-hidden />
            <span className="text-ink">Free domestic shipping unlocked.</span>
          </>
        ) : (
          <span className="text-ink-soft">
            <span className="font-mono-data text-ink">{formatPrice(remaining * 100)}</span>{" "}
            away from free domestic shipping
          </span>
        )}
      </div>
      <div
        className="h-1 w-full bg-paper border rule overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={FREE_SHIPPING_THRESHOLD}
        aria-valuenow={Math.min(subtotal, FREE_SHIPPING_THRESHOLD)}
        aria-label="Free shipping progress"
      >
        <div
          className={cn("h-full transition-all duration-300", unlocked ? "bg-gold" : "bg-ink")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

const TRUST_ITEMS = [
  { icon: Flag, label: "Made in USA", sub: "Synthesized + tested stateside" },
  { icon: ShieldCheck, label: "≥99% HPLC", sub: "Verified per lot" },
  { icon: QrCode, label: "QR-COA on every vial", sub: "Scan to see receipts" },
  { icon: Snowflake, label: "Cold-chain shipped", sub: "Insulated, tracked" },
] as const;

function TrustStrip() {
  return (
    <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-y rule py-4">
      {TRUST_ITEMS.map(({ icon: Icon, label, sub }) => (
        <li key={label} className="flex items-start gap-2">
          <Icon className="w-4 h-4 mt-0.5 text-ink shrink-0" strokeWidth={1.5} aria-hidden />
          <div className="min-w-0">
            <div className="text-xs font-medium text-ink leading-tight">{label}</div>
            <div className="text-[10px] text-ink-muted leading-tight mt-0.5">{sub}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

const TIMELINE_STEPS = [
  {
    when: "Now",
    title: "You submit your order",
    body: "RUO certification recorded; order locked for our team.",
  },
  {
    when: "Within minutes",
    title: "Payment instructions in your inbox",
    body: "We email wire / crypto / card details for the method you chose.",
  },
  {
    when: "1–2 business days",
    title: "Ships from our US lab",
    body: "Cold-chain pack with QR-COA on every vial. Tracking included.",
  },
] as const;

function NextStepsTimeline() {
  return (
    <section aria-label="What happens after you submit" className="space-y-3">
      <div className="label-eyebrow text-ink-muted">What happens next</div>
      <ol className="space-y-3">
        {TIMELINE_STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <div
              className="font-mono-data text-xs text-ink-muted w-6 shrink-0 pt-0.5"
              aria-hidden
            >
              0{i + 1}
            </div>
            <div className="min-w-0">
              <div className="text-xs label-eyebrow text-ink-muted">{step.when}</div>
              <div className="text-sm text-ink leading-snug">{step.title}</div>
              <div className="text-xs text-ink-soft leading-snug mt-0.5">{step.body}</div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="label-eyebrow text-ink-muted">{title}</h2>
      {children}
    </section>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  autoComplete?: string;
  multiline?: boolean;
}

function Field({ label, value, onChange, required, type = "text", autoComplete, multiline }: FieldProps) {
  const base =
    "w-full border rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:border-ink";
  return (
    <label className="block">
      <span className="block text-xs text-ink-muted mb-1">
        {label}
        {required && <span className="text-wine"> *</span>}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={base}
        />
      ) : (
        <input
          type={type}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={base}
        />
      )}
    </label>
  );
}
