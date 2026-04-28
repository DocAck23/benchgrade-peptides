import type { Metadata } from "next";

const PRIVACY_EFFECTIVE_DATE = "April 22, 2026";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How Bench Grade Peptides LLC collects, uses, and retains customer data — order details, RUO acknowledgments, and analytics. We don't sell or rent customer data.",
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: "Privacy Policy · Bench Grade Peptides",
    description:
      "How we collect, use, and retain customer data. We don't sell or rent customer data.",
    url: "/privacy",
    type: "website",
  },
};

export default function PrivacyPage() {
  return (
    <article className="max-w-3xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
      <div className="label-eyebrow text-ink-muted mb-6">Legal</div>
      <h1 className="font-display text-5xl lg:text-6xl leading-tight text-ink mb-4">
        Privacy Policy
      </h1>
      <p className="label-eyebrow text-ink-muted mb-12">Effective: {PRIVACY_EFFECTIVE_DATE}</p>

      <div className="space-y-8 text-base text-ink-soft leading-relaxed">
        <section>
          <h2 className="font-display text-2xl text-ink mb-3">1. Information we collect</h2>
          <p>
            We collect only the information you provide in the course of placing an order: contact
            details, shipping address, and institutional affiliation where you supply it. We also
            capture server-side metadata on your research-use-only acknowledgment (IP address, user
            agent, and timestamp) as part of our compliance record.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-3">2. What we don't collect</h2>
          <p>
            We do not collect health data, symptom information, or medical history. We do not profile
            for disease or condition targeting. We do not sell or rent customer data.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-3">3. How we use your information</h2>
          <p>
            Order fulfillment, customer support, legal compliance, and lot traceability. Transactional
            email (order confirmation, shipping updates, COA references) is sent via Resend. Analytics
            are limited to aggregate traffic measurement.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-3">4. Retention</h2>
          <p>
            Order records and research-use-only acknowledgments are retained as part of our compliance
            documentation. Account data is retained for the life of the account. You may request
            deletion of non-legally-required data by emailing{" "}
            <a href="mailto:admin@benchgradepeptides.com" className="text-teal underline">
              admin@benchgradepeptides.com
            </a>.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-3">5. Contact</h2>
          <p>
            Privacy questions:{" "}
            <a href="mailto:admin@benchgradepeptides.com" className="text-teal underline">
              admin@benchgradepeptides.com
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}
