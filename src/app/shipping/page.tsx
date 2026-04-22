import type { Metadata } from "next";
import { Callout } from "@/components/ui";

export const metadata: Metadata = {
  title: "Shipping & handling",
  description:
    "US domestic shipping tiers, lead times, and cold-chain handling for Bench Grade Peptides orders.",
};

export default function ShippingPage() {
  return (
    <article className="max-w-3xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
      <div className="label-eyebrow text-ink-muted mb-6">Shipping</div>
      <h1 className="font-display text-5xl lg:text-6xl leading-tight text-ink mb-10">
        Shipping &amp; handling.
      </h1>

      <div className="space-y-10 text-base text-ink-soft leading-relaxed">
        <section>
          <h2 className="font-display text-2xl text-ink mb-4">Domestic only</h2>
          <p>
            Bench Grade Peptides ships within the United States only. International shipping is not offered.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-4">Service tiers</h2>
          <dl className="border-t rule">
            <div className="grid grid-cols-[1fr_auto] gap-4 py-4 border-b rule">
              <dt className="text-ink">Ground</dt>
              <dd className="font-mono-data text-sm text-ink">+$25 · free over $200</dd>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-4 py-4 border-b rule">
              <dt className="text-ink">2-day air</dt>
              <dd className="font-mono-data text-sm text-ink">+$45</dd>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-4 py-4 border-b rule">
              <dt className="text-ink">Overnight</dt>
              <dd className="font-mono-data text-sm text-ink">+$90</dd>
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-4 py-4 border-b rule">
              <dt className="text-ink">Priority overnight</dt>
              <dd className="font-mono-data text-sm text-ink">+$150</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-4">Cold-chain handling</h2>
          <p>
            Lyophilized peptides are temperature-sensitive. Orders are packed with cold packs where
            the compound or season requires it. For overnight shipments during summer months, we
            recommend selecting 2-day air or overnight service to minimize transit time.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-4">Processing time</h2>
          <p>
            Orders placed before 12:00 PM ET on a business day with cleared payment ship same-day.
            Payment via ACH or wire may add 1–3 business days to the processing window.
          </p>
        </section>

        <Callout variant="info">
          Every outbound shipment includes a printed RUO declaration card, a per-lot Certificate of
          Analysis reference, and lot tracking back to our quality records.
        </Callout>
      </div>
    </article>
  );
}
