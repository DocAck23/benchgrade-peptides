import type { Metadata } from "next";
import { Callout, DataRow } from "@/components/ui";

export const metadata: Metadata = {
  title: "Payment methods",
  description: "ACH, wire, and check payment instructions for Bench Grade Peptides orders.",
};

export default function PaymentsPage() {
  return (
    <article className="max-w-3xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
      <div className="label-eyebrow text-ink-muted mb-6">Payments</div>
      <h1 className="font-display text-5xl lg:text-6xl leading-tight text-ink mb-10">
        Payment methods.
      </h1>

      <div className="space-y-10 text-base text-ink-soft leading-relaxed">
        <section>
          <p>
            Bench Grade Peptides accepts payment via ACH, bank wire, and company check. Orders are
            released for processing once cleared payment is received.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-4">Methods at a glance</h2>
          <dl className="bg-paper-soft border rule px-5 py-1">
            <DataRow label="ACH" value="1–3 business days to clear" />
            <DataRow label="Bank wire" value="Same- or next-business-day" />
            <DataRow label="Check" value="5–7 business days after receipt" />
          </dl>
        </section>

        <Callout variant="info" title="How it works">
          After you complete checkout, we email payment instructions for the method you selected.
          We do not store any banking credentials on this site, and we do not process cards.
          Once payment clears, your order enters processing and ships within the timeframe listed
          on the Shipping page.
        </Callout>

        <section>
          <h2 className="font-display text-2xl text-ink mb-4">Volume &amp; institutional accounts</h2>
          <p>
            Research institutions, universities, and laboratories with recurring purchasing needs can
            request a net-30 account. Contact{" "}
            <a href="mailto:admin@benchgradepeptides.com" className="text-teal underline">
              admin@benchgradepeptides.com
            </a>{" "}
            with your institutional details for review.
          </p>
        </section>
      </div>
    </article>
  );
}
