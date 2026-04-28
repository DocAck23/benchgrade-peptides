"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Flag, ShieldCheck, QrCode, Snowflake, Check, Pencil } from "lucide-react";
import { useCart } from "@/lib/cart/CartContext";
import { RUOGate, type RUOAcknowledgmentPayload } from "@/components/compliance/RUOGate";
import {
  submitOrder,
  checkIsFirstTimeBuyer,
  type CustomerInfo,
} from "@/app/actions/orders";
import {
  previewCouponForCheckout,
  type CouponPreviewResult,
} from "@/app/actions/coupon-preview";
import { getLifetimeShippingForMe } from "@/app/actions/lifetime-shipping";
import { formatPrice, cn } from "@/lib/utils";
import { Callout } from "@/components/ui";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/site";
import { CardProcessorFootnote } from "@/components/checkout/CardProcessorFootnote";
import { PaymentMethodAccordion } from "@/components/checkout/PaymentMethodAccordion";
import { SubscriptionUpsellCard } from "@/components/checkout/SubscriptionUpsellCard";
import { parseReferralCookie } from "@/lib/referrals/cookie";
import {
  PRODUCTS,
  SUPPLIES,
  getSupplyVariantBySku,
  type CatalogProduct,
} from "@/lib/catalogue/data";
import {
  type PaymentMethod,
  type PaymentMethodDetails,
} from "@/lib/payments/methods";
import {
  personalVialDiscount,
  type AffiliateTier,
} from "@/lib/affiliate/tiers";
import { US_STATES_AND_TERRITORIES, US_STATES_OPTIONS } from "@/lib/geography/us-states";
import { sendAnalyticsEvent } from "@/lib/analytics/client";

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

const BAC_WATER_SKU = "BAC-WATER-10ML";
const SYRINGE_SKU = "SYRINGE-INSULIN-100";

type Step = 1 | 2 | 3 | 4;

interface CheckoutPageClientProps {
  availableMethods: PaymentMethod[];
  paymentDetails: PaymentMethodDetails;
  affiliate?: { tier: AffiliateTier } | null;
}

export function CheckoutPageClient({
  availableMethods,
  paymentDetails,
  affiliate = null,
}: CheckoutPageClientProps) {
  const router = useRouter();
  const {
    items,
    subtotal,
    itemCount,
    totals,
    subscriptionMode,
    setSubscriptionMode,
    clear,
    addItem,
    removeItem,
  } = useCart();
  const hasStackSave = totals.stack_save_discount_cents > 0;
  const hasSameSku = totals.same_sku_discount_cents > 0;
  const hasAnyDiscount = hasStackSave || hasSameSku;

  const [step, setStep] = useState<Step>(1);
  const [maxReached, setMaxReached] = useState<Step>(1);
  const [form, setForm] = useState<CustomerInfo>(EMPTY);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(
    availableMethods[0] ?? ""
  );
  const [ruoOpen, setRuoOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  // Coupon preview state — populated by previewCouponForCheckout when
  // the customer hits "Apply" or blurs the field. Cosmetic only; the
  // server re-validates at submit and the apply lives in the atomic
  // `redeem_coupon` Postgres RPC.
  const [couponPreview, setCouponPreview] =
    useState<CouponPreviewResult | null>(null);
  const [couponChecking, setCouponChecking] = useState(false);
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // First-time-buyer state. Resolved server-side when the customer
  // advances from step 1 to step 2 — `checkIsFirstTimeBuyer` queries
  // the orders table by lower(email). Cosmetic; the discount is
  // re-validated authoritatively in submitOrder.
  const [isFirstTime, setIsFirstTime] = useState<boolean | null>(null);
  const [firstTimeVialSku, setFirstTimeVialSku] = useState<string>("");
  // Lifetime free-shipping eligibility (FIRST250 cohort members).
  // Resolved against the auth-user OR the email the customer types
  // into step 1; flips the FreeShippingBar to a "perk recognized"
  // state instead of the threshold pill.
  const [lifetimeShipping, setLifetimeShipping] = useState(false);

  // Sprint 3 Wave C — referral discount preview line.
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

  // Fire `checkout_start` once per mount so abandoned-checkout rates
  // are computable. Lives BEFORE the early-return guards because hook
  // call order has to be stable across renders — moving it below the
  // empty-cart guard caused a Rules of Hooks violation.
  useEffect(() => {
    sendAnalyticsEvent("checkout_start", {
      properties: {
        item_count: itemCount,
        subtotal_cents: Math.round(subtotal * 100),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inFlight = useRef(false);

  // Cart-mutation helpers for the supply addons. Look up the supply
  // entries from the catalogue so we feed the cart's addItem the same
  // product/variant shapes a normal add would use.
  const bacWaterInCart = useMemo(
    () => items.some((i) => i.sku === BAC_WATER_SKU),
    [items],
  );
  const syringeInCart = useMemo(
    () => items.some((i) => i.sku === SYRINGE_SKU),
    [items],
  );

  const peptideLines = useMemo(
    () => items.filter((i) => !i.is_supply),
    [items],
  );

  // Catalogue rows used to populate the first-time-vial picker. The
  // perk is "add an ADDITIONAL vial of your choosing at 25% off" —
  // not "discount a vial already in cart" — so we surface every
  // peptide variant in the catalog, not just lines already in the
  // cart. Server appends the chosen SKU as a bonus line at
  // retail × 0.75; founder spec.
  const firstTimeChoices = useMemo(() => {
    return PRODUCTS.flatMap((p) =>
      p.variants.map((v) => ({
        sku: v.sku,
        label: `${p.name} · ${v.size_mg}mg · ${v.pack_size}-vial — ${formatPrice(
          Math.round(v.retail_price * 100 * 0.75),
        )} (25% off ${formatPrice(v.retail_price * 100)})`,
        unit_price_cents: Math.round(v.retail_price * 100),
      })),
    );
  }, []);

  const firstTimeDiscountPreviewCents = useMemo(() => {
    if (!isFirstTime || !firstTimeVialSku) return 0;
    const choice = firstTimeChoices.find((c) => c.sku === firstTimeVialSku);
    return choice ? Math.round(choice.unit_price_cents * 0.25) : 0;
  }, [isFirstTime, firstTimeVialSku, firstTimeChoices]);

  // Best-of "other discount" stack the coupon preview compares
  // against. Lives ABOVE the empty-cart / no-payments guards because
  // hook order has to be stable across renders.
  const otherDiscountForCouponPreviewCents = useMemo(() => {
    return (
      totals.stack_save_discount_cents +
      totals.same_sku_discount_cents +
      firstTimeDiscountPreviewCents +
      (referralPreview?.discountCents ?? 0)
    );
  }, [
    totals.stack_save_discount_cents,
    totals.same_sku_discount_cents,
    firstTimeDiscountPreviewCents,
    referralPreview,
  ]);

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

  // Step 1 → step 2 advance. Validates required fields locally so we
  // don't ping the server on obviously incomplete forms, then calls
  // checkIsFirstTimeBuyer with the email to decide if step 2 should
  // surface the 50%-off-any-vial offer.
  const onContinueStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setStep1Error(null);
    if (!form.name.trim()) return setStep1Error("Full name is required.");
    if (!form.email.trim() || !/^\S+@\S+\.\S+$/u.test(form.email.trim()))
      return setStep1Error("Valid email is required.");
    if (!form.ship_address_1.trim()) return setStep1Error("Shipping address is required.");
    if (!form.ship_city.trim()) return setStep1Error("City is required.");
    const stateUpper = form.ship_state.trim().toUpperCase();
    if (!US_STATES_AND_TERRITORIES.has(stateUpper))
      return setStep1Error("Valid US state, territory, or APO code is required.");
    if (!/^\d{5}(-\d{4})?$/u.test(form.ship_zip.trim()))
      return setStep1Error("ZIP code is invalid.");

    try {
      const [firstTimeRes, lifetimeRes] = await Promise.all([
        checkIsFirstTimeBuyer(form.email.trim()),
        getLifetimeShippingForMe({ email: form.email.trim() }),
      ]);
      setIsFirstTime(firstTimeRes.first_time);
      setLifetimeShipping(lifetimeRes.eligible);
    } catch {
      setIsFirstTime(false);
      setLifetimeShipping(false);
    }
    advance(2);
  };

  const advance = (next: Step) => {
    setStep(next);
    if (next > maxReached) setMaxReached(next);
    sendAnalyticsEvent("checkout_step", { properties: { step: next } });
  };

  // BAC water toggle. Adding routes through addItem so the cart's
  // bundle-supply pricing logic (first unit free) applies the same as
  // an auto-add. Removing only takes the supply line out — peptide
  // lines untouched.
  const toggleBacWater = (want: boolean) => {
    const supply = getSupplyVariantBySku(BAC_WATER_SKU);
    if (!supply) return;
    if (want && !bacWaterInCart) addItem(supply.product, supply.variant, 1);
    if (!want && bacWaterInCart) removeItem(BAC_WATER_SKU);
  };
  const toggleSyringes = (want: boolean) => {
    const supply = getSupplyVariantBySku(SYRINGE_SKU);
    if (!supply) return;
    if (want && !syringeInCart) addItem(supply.product, supply.variant, 1);
    if (!want && syringeInCart) removeItem(SYRINGE_SKU);
  };

  // Best-of "other discount" stack the coupon preview compares against
  // — Stack & Save + same-SKU + first-time-vial preview + (cosmetic)
  // referral. Affiliate discount sits on top of these and is only
  // applied authoritatively on the server, so we leave it out of the
  // preview to avoid promising a customer-facing number we can't
  // guarantee at submit time.
  const previewCoupon = async () => {
    const code = couponCode.trim().toLowerCase();
    if (!code) {
      setCouponPreview(null);
      return;
    }
    setCouponChecking(true);
    try {
      // Sum peptide-vial quantities (excludes BAC water / syringes).
      // FOUNDER's preview gate uses this to enforce its 3-vial rule.
      const vialQty = peptideLines.reduce((s, l) => s + l.quantity, 0);
      const res = await previewCouponForCheckout({
        code,
        subtotal_cents: Math.round(subtotal * 100),
        other_discount_cents: otherDiscountForCouponPreviewCents,
        email: form.email.trim() || null,
        vial_quantity: vialQty,
      });
      setCouponPreview(res);
      sendAnalyticsEvent("coupon_attempt", {
        properties: {
          code,
          status: res.status,
          coupon_discount_cents: res.coupon_discount_cents,
        },
      });
    } catch {
      setCouponPreview({
        status: "invalid_input",
        coupon_discount_cents: 0,
        other_discount_cents: 0,
        applied_discount_cents: 0,
        next_total_cents: 0,
        message: "Coupon check failed — try again.",
      });
    } finally {
      setCouponChecking(false);
    }
  };

  const onSubmitFinal = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!paymentMethod) {
      setError("Please choose a payment method.");
      return;
    }
    setRuoOpen(true);
  };

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
        marketing_opt_in: marketingOptIn,
        coupon_code: couponCode.trim() ? couponCode.trim().toLowerCase() : null,
        first_time_vial_sku: firstTimeVialSku || null,
      });
      if (!res.ok) {
        setError(res.error ?? "Order submission failed.");
        setSubmitting(false);
        inFlight.current = false;
        return;
      }
      // Email goes onto the session row server-side (so we can
      // correlate this anonymous session to the customer in
      // analytics), and total_cents lands in properties for AOV.
      sendAnalyticsEvent("order_submitted", {
        properties: {
          order_id: res.order_id,
          email: form.email.trim().toLowerCase(),
          total_cents: totals.total_cents,
          payment_method: paymentMethod,
          item_count: itemCount,
        },
      });
      clear();
      const params = new URLSearchParams({ id: res.order_id ?? "" });
      if (res.success_token) params.set("t", res.success_token);
      router.push(`/checkout/success?${params.toString()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
      setSubmitting(false);
      inFlight.current = false;
    }
  };

  const stepTitles: Record<Step, string> = {
    1: "Your details",
    2: "Add-ons",
    3: "Subscribe & save",
    4: "Payment",
  };

  return (
    <article className="max-w-5xl mx-auto px-6 lg:px-10 py-12 lg:py-16">
      <div className="label-eyebrow text-ink-muted mb-4">Checkout</div>
      <h1 className="font-display text-4xl lg:text-5xl leading-tight text-ink mb-6">
        Complete your order.
      </h1>

      <ProgressBar step={step} titles={stepTitles} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-10 mt-8">
        <div className="space-y-4">
          {/* Step 1 — Contact + shipping */}
          <StepShell
            n={1}
            title={stepTitles[1]}
            active={step === 1}
            done={step > 1}
            onEdit={() => setStep(1)}
            collapsedSummary={
              step > 1 && (
                <div className="text-sm text-ink-soft space-y-0.5">
                  <div>{form.name} · {form.email}</div>
                  <div>
                    {form.ship_address_1}
                    {form.ship_address_2 ? `, ${form.ship_address_2}` : ""}, {form.ship_city}, {form.ship_state.toUpperCase()} {form.ship_zip}
                  </div>
                </div>
              )
            }
          >
            <form onSubmit={onContinueStep1} className="space-y-6">
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
                  <StateSelect label="State" required value={form.ship_state} onChange={(v) => update("ship_state", v)} />
                </div>
                <Field label="ZIP" required value={form.ship_zip} onChange={(v) => update("ship_zip", v)} autoComplete="postal-code" />
              </Section>

              {step1Error && (
                <div className="border border-danger/40 bg-danger/5 text-danger px-4 py-3 text-sm">
                  {step1Error}
                </div>
              )}

              <ContinueButton>Continue to add-ons</ContinueButton>
            </form>
          </StepShell>

          {/* Step 2 — Addons */}
          <StepShell
            n={2}
            title={stepTitles[2]}
            active={step === 2}
            done={step > 2}
            onEdit={() => setStep(2)}
            locked={maxReached < 2}
            collapsedSummary={
              step > 2 && (
                <div className="text-sm text-ink-soft">
                  {[
                    isFirstTime && firstTimeVialSku ? "50% off first-time vial" : null,
                    bacWaterInCart ? "BAC water" : null,
                    syringeInCart ? "Syringes" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "No add-ons"}
                </div>
              )
            }
          >
            <div className="space-y-4">
              {isFirstTime && firstTimeChoices.length > 0 && (
                <AddonCard
                  title="First-time researcher · 25% off an additional vial"
                  body="Pick a vial as your first-order bonus — 25% off one additional unit on top of your cart. Stacks with every other discount."
                  highlight
                >
                  <label className="flex flex-col gap-1.5 mt-3">
                    <span className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                      Apply to
                    </span>
                    <select
                      value={firstTimeVialSku}
                      onChange={(e) => setFirstTimeVialSku(e.target.value)}
                      className="h-10 px-3 border rule bg-paper text-sm focus:outline-none focus:border-ink"
                    >
                      <option value="">— Skip this offer —</option>
                      {firstTimeChoices.map((c) => (
                        <option key={c.sku} value={c.sku}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </AddonCard>
              )}

              <AddonCard
                title="Free Bacteriostatic Water (10ml)"
                body="Sterile reconstitution water — included free with your order. Untick if you've already got plenty from a previous shipment."
              >
                <ToggleRow
                  label="Add free BAC water"
                  checked={bacWaterInCart}
                  onChange={toggleBacWater}
                />
              </AddonCard>

              <AddonCard
                title="Insulin syringes — pack of 100 ($15)"
                body="29G ½″ single-use 1ml syringes for subcutaneous research administration. First pack is included free; add now if you need them."
              >
                <ToggleRow
                  label="Add syringe pack"
                  checked={syringeInCart}
                  onChange={toggleSyringes}
                />
              </AddonCard>

              <ContinueButton onClick={() => advance(3)}>
                Continue
              </ContinueButton>
            </div>
          </StepShell>

          {/* Step 3 — Explicit Subscribe-OR-OneTime choice */}
          <StepShell
            n={3}
            title={stepTitles[3]}
            active={step === 3}
            done={step > 3}
            onEdit={() => setStep(3)}
            locked={maxReached < 3}
            collapsedSummary={
              step > 3 && (
                <div className="text-sm text-ink-soft">
                  {subscriptionMode
                    ? `Subscription · ${subscriptionMode.duration_months}-month plan`
                    : "One-time order"}
                </div>
              )
            }
          >
            <SubscribeChoiceStep
              hasSubscription={subscriptionMode !== null}
              onPickOneTime={() => {
                setSubscriptionMode(null);
                advance(4);
              }}
              onContinue={() => advance(4)}
            />
          </StepShell>

          {/* Step 4 — Payment, coupon, notes, submit */}
          <StepShell
            n={4}
            title={stepTitles[4]}
            active={step === 4}
            done={false}
            onEdit={() => setStep(4)}
            locked={maxReached < 4}
          >
            <form onSubmit={onSubmitFinal} className="space-y-8">
              <Section title="Payment method">
                <div className="mb-4">
                  <CardProcessorFootnote />
                </div>
                <PaymentMethodAccordion
                  availableMethods={availableMethods}
                  details={paymentDetails}
                  selected={paymentMethod}
                  onSelect={(m) => setPaymentMethod(m)}
                />
              </Section>

              <Section title="Coupon (optional)">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[10px] uppercase tracking-[0.1em] text-ink-muted">
                    Coupon code
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => {
                        setCouponCode(e.target.value);
                        setCouponPreview(null);
                      }}
                      onBlur={() => {
                        if (couponCode.trim()) void previewCoupon();
                      }}
                      disabled={submitting}
                      autoCapitalize="characters"
                      className="flex-1 h-10 px-3 border rule bg-paper text-sm font-mono-data uppercase focus:outline-none focus:border-ink"
                      placeholder="WELCOME10"
                    />
                    <button
                      type="button"
                      onClick={() => void previewCoupon()}
                      disabled={submitting || couponChecking || !couponCode.trim()}
                      className="h-10 px-4 border border-ink text-sm tracking-[0.04em] hover:bg-ink hover:text-paper disabled:opacity-60"
                    >
                      {couponChecking ? "Checking…" : "Apply"}
                    </button>
                  </div>
                  {couponPreview && (
                    <div
                      className={cn(
                        "border rule px-3 py-2 text-xs leading-snug mt-1",
                        couponPreview.status === "applied"
                          ? "bg-gold-dark/10 border-gold-dark/40 text-gold-dark"
                          : couponPreview.status === "auth_required"
                            ? "bg-wine/5 border-wine/40 text-wine"
                            : "bg-paper-soft text-ink-soft",
                      )}
                      data-testid="coupon-preview"
                    >
                      <div>{couponPreview.message}</div>
                      {couponPreview.status === "auth_required" && (
                        <Link
                          href={`/login?next=${encodeURIComponent("/checkout")}`}
                          className="inline-flex items-center mt-2 h-9 px-4 bg-wine text-paper text-[11px] tracking-[0.06em] uppercase hover:bg-ink transition-colors"
                        >
                          Create my account →
                        </Link>
                      )}
                    </div>
                  )}
                  <span className="text-[11px] text-ink-muted leading-snug">
                    Coupon does not stack with Stack &amp; Save or referrals — we&rsquo;ll
                    automatically apply whichever discount saves you the most.
                  </span>
                </label>
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

              <label className="flex items-start gap-3 cursor-pointer text-sm text-ink-soft">
                <input
                  type="checkbox"
                  checked={marketingOptIn}
                  onChange={(e) => setMarketingOptIn(e.target.checked)}
                  disabled={submitting}
                  className="mt-1 w-4 h-4 accent-wine cursor-pointer"
                />
                <span>
                  Email me occasional research updates and new-compound announcements
                  from Bench Grade Peptides. Transactional order emails always send
                  regardless. Unsubscribe anytime.
                </span>
              </label>

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
          </StepShell>
        </div>

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
            {firstTimeDiscountPreviewCents > 0 && (
              <div
                className="flex items-baseline justify-between"
                data-testid="first-time-vial-preview"
              >
                <span
                  className="text-xs text-gold-dark italic"
                  style={{ fontFamily: "var(--font-editorial)" }}
                >
                  First-order 25% off · 1 vial
                </span>
                <span className="font-mono-data text-sm text-gold-dark">
                  −{formatPrice(firstTimeDiscountPreviewCents)}
                </span>
              </div>
            )}
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
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </span>
              <span className="font-mono-data text-lg text-wine">
                {formatPrice(
                  Math.max(totals.total_cents - firstTimeDiscountPreviewCents, 0),
                )}
              </span>
            </div>
          </div>
          <FreeShippingBar subtotal={subtotal} lifetimeMember={lifetimeShipping} />
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

// Suppress unused-import warnings for catalog rows we may want to lean
// on later (full-catalog SKU pickers, supply-row metadata in the
// addons step, etc.). They're kept imported because the addon UI is
// genuinely about to grow into them.
void PRODUCTS;
void SUPPLIES;
void ({} as CatalogProduct);

/**
 * Step-3 inner UI. Two tabs visible upfront — One-time / Subscribe &
 * save — so customers can compare the two paths without committing to
 * "Subscribe" first. Picking "One-time" clears any pending subscription
 * draft; picking "Subscribe & save" reveals the tier picker.
 */
function SubscribeChoiceStep({
  hasSubscription,
  onPickOneTime,
  onContinue,
}: {
  hasSubscription: boolean;
  onPickOneTime: () => void;
  onContinue: () => void;
}) {
  // Default tab: subscribe-already-set → subscribe; otherwise one-time.
  const [tab, setTab] = useState<"one-time" | "subscribe">(
    hasSubscription ? "subscribe" : "one-time",
  );

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Order type" className="grid grid-cols-2 border rule">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "one-time"}
          onClick={() => {
            setTab("one-time");
            // Clear any pending subscription draft so payment step
            // sees a clean one-time cart.
            if (hasSubscription) onPickOneTime();
          }}
          className={cn(
            "h-12 px-5 text-sm tracking-[0.04em] transition-colors",
            tab === "one-time"
              ? "bg-ink text-paper"
              : "bg-paper text-ink hover:bg-paper-soft",
          )}
        >
          One-time order
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "subscribe"}
          onClick={() => setTab("subscribe")}
          className={cn(
            "h-12 px-5 text-sm tracking-[0.04em] transition-colors border-l rule",
            tab === "subscribe"
              ? "bg-ink text-paper"
              : "bg-paper text-ink hover:bg-paper-soft",
          )}
        >
          Subscribe &amp; save
        </button>
      </div>

      {tab === "one-time" ? (
        <p className="text-sm text-ink-soft">
          Pay once, ship once. Switch to <em>Subscribe &amp; save</em> above to
          lock in a multi-month discount.
        </p>
      ) : (
        <SubscriptionUpsellCard />
      )}

      <ContinueButton onClick={onContinue}>
        Continue to payment
      </ContinueButton>
    </div>
  );
}

function ProgressBar({
  step,
  titles,
}: {
  step: Step;
  titles: Record<Step, string>;
}) {
  const steps: Step[] = [1, 2, 3, 4];
  return (
    <ol className="flex items-center gap-2 text-xs">
      {steps.map((s, idx) => {
        const isActive = s === step;
        const isDone = s < step;
        return (
          <li key={s} className="flex items-center gap-2 flex-1 min-w-0">
            <div
              className={cn(
                "flex items-center gap-2 min-w-0",
                isActive ? "text-ink" : isDone ? "text-gold-dark" : "text-ink-muted",
              )}
            >
              <span
                className={cn(
                  "w-6 h-6 inline-flex items-center justify-center border rule font-mono-data text-[11px] shrink-0",
                  isActive
                    ? "bg-ink text-paper border-ink"
                    : isDone
                      ? "bg-gold-dark/10 border-gold-dark text-gold-dark"
                      : "bg-paper",
                )}
              >
                {isDone ? <Check className="w-3 h-3" strokeWidth={2.5} /> : s}
              </span>
              <span className="truncate text-[11px] uppercase tracking-[0.08em]">
                {titles[s]}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <span
                className={cn(
                  "h-px flex-1",
                  isDone ? "bg-gold-dark" : "bg-rule",
                )}
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

interface StepShellProps {
  n: Step;
  title: string;
  active: boolean;
  done: boolean;
  locked?: boolean;
  onEdit: () => void;
  collapsedSummary?: React.ReactNode;
  children: React.ReactNode;
}

function StepShell({
  n,
  title,
  active,
  done,
  locked = false,
  onEdit,
  collapsedSummary,
  children,
}: StepShellProps) {
  return (
    <section
      className={cn(
        "border rule bg-paper transition-opacity",
        locked && !active && !done ? "opacity-50" : "opacity-100",
      )}
      aria-current={active ? "step" : undefined}
    >
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b rule">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={cn(
              "w-6 h-6 inline-flex items-center justify-center border rule font-mono-data text-[11px] shrink-0",
              done
                ? "bg-gold-dark/10 border-gold-dark text-gold-dark"
                : active
                  ? "bg-ink text-paper border-ink"
                  : "bg-paper text-ink-muted",
            )}
          >
            {done ? <Check className="w-3 h-3" strokeWidth={2.5} /> : n}
          </span>
          <h2 className="text-sm tracking-[0.04em] text-ink truncate">{title}</h2>
        </div>
        {done && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 text-xs text-ink-soft hover:text-ink"
          >
            <Pencil className="w-3 h-3" aria-hidden /> Edit
          </button>
        )}
      </header>
      {(active || done) && (
        <div className="px-5 py-5">
          {active ? children : collapsedSummary}
        </div>
      )}
    </section>
  );
}

function ContinueButton({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type={onClick ? "button" : "submit"}
      onClick={onClick}
      className="flex items-center justify-center w-full h-11 bg-ink text-paper text-sm tracking-[0.04em] hover:bg-gold transition-colors"
    >
      {children}
    </button>
  );
}

function AddonCard({
  title,
  body,
  highlight,
  children,
}: {
  title: string;
  body: string;
  highlight?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "border rule p-4",
        highlight ? "bg-gold-dark/5 border-gold-dark/40" : "bg-paper-soft",
      )}
    >
      <div className="text-sm text-ink font-medium leading-snug">{title}</div>
      <div className="text-xs text-ink-soft leading-snug mt-1">{body}</div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer mt-3 text-sm text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-wine cursor-pointer"
      />
      <span>{label}</span>
    </label>
  );
}

function FreeShippingBar({
  subtotal,
  lifetimeMember = false,
}: {
  subtotal: number;
  lifetimeMember?: boolean;
}) {
  // Lifetime cohort members (FIRST250) get free shipping forever,
  // regardless of cart subtotal — render a celebratory pill instead
  // of the threshold progress bar.
  if (lifetimeMember) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <Check
            className="w-3.5 h-3.5 text-gold"
            strokeWidth={2}
            aria-hidden
          />
          <span className="text-ink">
            Free domestic shipping included &mdash;{" "}
            <span className="text-gold-dark">FIRST-250 cohort perk.</span>
          </span>
        </div>
        <div
          className="h-1 w-full bg-gold"
          role="presentation"
          aria-hidden
        />
      </div>
    );
  }

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
  { icon: QrCode, label: "Per-lot COA", sub: "On product page + in shipment" },
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
    body: "Cold-chain pack with FedEx tracking. Per-lot Certificate of Analysis is published on the product page and included with every shipment.",
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

function StateSelect({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const base =
    "w-full border rule bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:border-ink";
  return (
    <label className="block">
      <span className="block text-xs text-ink-muted mb-1">
        {label}
        {required && <span className="text-wine"> *</span>}
      </span>
      <select
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="address-level1"
        className={base}
      >
        <option value="">Select state…</option>
        {US_STATES_OPTIONS.map((s) => (
          <option key={s.code} value={s.code}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
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
