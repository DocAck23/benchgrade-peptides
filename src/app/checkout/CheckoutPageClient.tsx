"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";
import { RUOGate, type RUOAcknowledgmentPayload } from "@/components/compliance/RUOGate";
import { submitOrder, type CustomerInfo } from "@/app/actions/orders";
import { formatPrice, cn } from "@/lib/utils";
import { Callout } from "@/components/ui";
import {
  type PaymentMethod,
  paymentMethodLabel,
  paymentMethodBlurb,
} from "@/lib/payments/methods";

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
}

export function CheckoutPageClient({ availableMethods }: CheckoutPageClientProps) {
  const router = useRouter();
  const { items, subtotal, itemCount, clear } = useCart();
  const [form, setForm] = useState<CustomerInfo>(EMPTY);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(
    availableMethods[0] ?? ""
  );
  const [ruoOpen, setRuoOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0 && !submitting) {
    return (
      <article className="max-w-3xl mx-auto px-6 lg:px-10 py-20 text-center">
        <h1 className="font-display text-4xl text-ink mb-6">Your cart is empty.</h1>
        <Link
          href="/catalog"
          className="inline-flex items-center h-12 px-8 bg-ink text-paper text-sm tracking-[0.04em] hover:bg-teal transition-colors"
        >
          Browse the catalog
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
            <div className="border border-oxblood/40 bg-oxblood/5 text-oxblood px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !paymentMethod}
            className="flex items-center justify-center w-full h-12 bg-ink text-paper text-sm tracking-[0.04em] hover:bg-teal transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting…" : "Review RUO certification & submit"}
          </button>
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
          <div className="border-t rule pt-4 flex items-baseline justify-between">
            <span className="text-sm text-ink-soft">
              {itemCount} {itemCount === 1 ? "vial" : "vials"}
            </span>
            <span className="font-mono-data text-lg text-ink">
              {formatPrice(subtotal * 100)}
            </span>
          </div>
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
        {required && <span className="text-oxblood"> *</span>}
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
