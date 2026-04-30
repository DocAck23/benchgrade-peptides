import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description:
    "Common questions about Bench Grade Peptides — RUO scope, payment methods, shipping, COAs, returns, and account management.",
  alternates: { canonical: "/faq" },
};

interface QA {
  q: string;
  a: React.ReactNode;
}

const SECTIONS: Array<{ title: string; items: QA[] }> = [
  {
    title: "What we sell",
    items: [
      {
        q: 'What does "Research Use Only" (RUO) mean?',
        a: (
          <>
            Every product on this site is supplied for laboratory research only. RUO
            materials are <strong>not drugs</strong>. They are not approved by the FDA
            for human or veterinary use, are not for diagnostic, therapeutic, or in-vivo
            experimental use, and are not dietary supplements. By accepting delivery you
            certify research-only intent and assume full responsibility for compliant
            handling. See our{" "}
            <Link href="/compliance" className="text-gold underline">
              Compliance &amp; RUO
            </Link>{" "}
            page for the full statement.
          </>
        ),
      },
      {
        q: "Do I need a license to order?",
        a: (
          <>
            For the SKUs we currently carry, no DEA license is required (we do not stock
            scheduled compounds). At checkout you certify that you are an adult and
            ordering for laboratory research use. We reserve the right to refuse or
            cancel any order that does not meet the certification.
          </>
        ),
      },
      {
        q: "How do I know what I received is what I ordered?",
        a: (
          <>
            Every lot is HPLC-verified and traceable to a per-lot Certificate of
            Analysis. Email{" "}
            <a href="mailto:admin@benchgradepeptides.com" className="text-gold underline">
              admin@benchgradepeptides.com
            </a>{" "}
            for any other COA-related question. The per-lot Certificate of
            Analysis itself is published on each product page and a printed copy
            ships inside every order — no need to email for a routine COA.
          </>
        ),
      },
    ],
  },
  {
    title: "Payment",
    items: [
      {
        q: "What payment methods do you accept?",
        a: (
          <>
            Wire transfer, ACH credit, Zelle, and crypto (BTC, ETH, USDT, USDC, LTC,
            and 40+ other tokens via NOWPayments). We do <strong>not</strong> accept
            credit or debit cards.
          </>
        ),
      },
      {
        q: "Why no cards?",
        a: (
          <>
            Card networks treat research-chemical merchants as high-risk and routinely
            close accounts without warning. Operating bank-rail-only keeps the storefront
            stable and lets us pass the savings (no card-processing fees) to lower
            sticker prices. See{" "}
            <Link href="/why-no-cards" className="text-gold underline">
              /why-no-cards
            </Link>{" "}
            for the longer version.
          </>
        ),
      },
      {
        q: "What's the order memo and why is it required?",
        a: (
          <>
            Every order has a unique 8-character memo that starts with{" "}
            <span className="font-mono-data">BGP-</span>. We don&rsquo;t use a card
            processor, so the memo is the only way we can match your wire / ACH / Zelle
            transfer back to your order. Without it, your order sits in the queue until
            we email you to confirm.
          </>
        ),
      },
      {
        q: "Can I change my payment method after I submit?",
        a: (
          <>
            Yes — sign in at{" "}
            <Link href="/login" className="text-gold underline">
              /login
            </Link>
            , open the order, and use the &ldquo;Change method&rdquo; button. You can
            switch any time before payment is received. Once funded, the method is
            locked.
          </>
        ),
      },
    ],
  },
  {
    title: "Shipping",
    items: [
      {
        q: "How long does shipping take?",
        a: (
          <>
            We ship within 1–2 business days of receiving funds. Domestic FedEx delivery
            is typically 2–4 business days. We&rsquo;ll email a tracking link the moment
            your box leaves our fulfillment partner.
          </>
        ),
      },
      {
        q: "Do you cold-chain ship?",
        a: (
          <>
            Yes. Lyophilized peptides are shipped insulated with cold packs. Reconstituted
            shelf-life and storage temperatures are on the per-lot COA — typically 2–8°C
            refrigerated for short-term and –20°C for 6+ months.
          </>
        ),
      },
      {
        q: "Do you ship internationally?",
        a: (
          <>
            Not at this time. We ship within the United States only (50 states + DC + APO/FPO
            addresses).
          </>
        ),
      },
      {
        q: "What if my package is damaged or missing?",
        a: (
          <>
            Email{" "}
            <a href="mailto:admin@benchgradepeptides.com" className="text-gold underline">
              admin@benchgradepeptides.com
            </a>{" "}
            with your order memo and a photo of the damage within 7 days of delivery.
            We&rsquo;ll replace damaged vials at no charge.
          </>
        ),
      },
    ],
  },
  {
    title: "Account & Orders",
    items: [
      {
        q: "Do I need to create an account?",
        a: (
          <>
            No. Checkout works as a guest. After you submit, we email a one-click magic
            link that signs you in to view, edit, or pay for the order — no password
            required. You can set a password later under{" "}
            <Link href="/account/security" className="text-gold underline">
              Account → Security
            </Link>{" "}
            if you prefer.
          </>
        ),
      },
      {
        q: "Can I edit my shipping address or cancel before paying?",
        a: (
          <>
            Yes. Sign in, open the order, and use the &ldquo;Edit shipping address&rdquo;
            or &ldquo;Cancel order&rdquo; button on the pay-now panel. Both are disabled
            once the order is funded — at that point email us to coordinate.
          </>
        ),
      },
      {
        q: "Refund policy?",
        a: (
          <>
            Unopened, unshipped orders can be cancelled by the researcher at any time before
            payment lands; once funded, we&rsquo;ll refund on request through the same
            payment rail (wire/ACH/Zelle credit, or on-chain refund for crypto). Once
            shipped, we replace damaged or mis-shipped product but cannot accept
            returns of opened RUO chemicals.
          </>
        ),
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <article className="max-w-3xl mx-auto px-6 lg:px-10 py-16 lg:py-24">
      <div className="label-eyebrow text-ink-muted mb-6">Frequently asked</div>
      <h1 className="font-display text-4xl lg:text-5xl leading-tight text-ink mb-10">
        Common questions.
      </h1>

      <div className="space-y-12">
        {SECTIONS.map((sec) => (
          <section key={sec.title}>
            <h2 className="font-display text-2xl text-ink mb-6 pb-3 border-b rule">
              {sec.title}
            </h2>
            <dl className="space-y-7">
              {sec.items.map((qa, i) => (
                <div key={i}>
                  <dt className="font-display text-base text-ink mb-2">{qa.q}</dt>
                  <dd className="text-ink-soft leading-relaxed">{qa.a}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>

      <div className="mt-16 pt-8 border-t rule text-sm text-ink-muted">
        Didn&rsquo;t find what you need? Email{" "}
        <a href="mailto:admin@benchgradepeptides.com" className="text-gold underline">
          admin@benchgradepeptides.com
        </a>{" "}
        — we typically respond within one business day.
      </div>
    </article>
  );
}
