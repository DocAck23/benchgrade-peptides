import type { Metadata } from "next";
import Link from "next/link";
import { RUO_STATEMENTS } from "@/lib/compliance";

export const metadata: Metadata = {
  title: "Compliance & research-use-only statement",
  description:
    "Bench Grade Peptides operates as a research chemical distributor. Products are supplied for laboratory research use only.",
};

export default function CompliancePage() {
  return (
    <article className="max-w-3xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
      <div className="label-eyebrow text-ink-muted mb-6">Compliance statement</div>
      <h1 className="font-display text-5xl lg:text-6xl leading-tight text-ink mb-10">
        A chemical supplier for laboratory research.
      </h1>

      <div className="space-y-8 text-ink-soft text-base lg:text-lg leading-relaxed">
        <p className="text-ink font-medium">{RUO_STATEMENTS.banner}</p>

        <section>
          <h2 className="font-display text-2xl text-ink mb-4">What Bench Grade Peptides is</h2>
          <p>
            Bench Grade Peptides LLC is a specialty research-chemical distributor. We supply
            lyophilized synthetic peptides to laboratories, research institutions, and qualified
            researchers for in vitro research purposes.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-4">What Bench Grade Peptides is not</h2>
          <ul className="list-disc ml-5 space-y-2">
            <li>We are not a compounding pharmacy, outsourcing facility, or registered drug establishment under FDA regulations.</li>
            <li>We are not a dietary supplement manufacturer or retailer under DSHEA.</li>
            <li>We are not a medical device manufacturer.</li>
            <li>We do not dispense, prescribe, or administer any product.</li>
            <li>Our products have not been evaluated or approved by the FDA for any purpose other than laboratory research.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-4">Customer certification requirement</h2>
          <p>Every customer is required to certify at checkout that:</p>
          <blockquote className="border-l-4 border-teal pl-6 py-2 my-6 italic text-ink-soft">
            {RUO_STATEMENTS.certification}
          </blockquote>
          <p>
            This certification is timestamped and retained with the corresponding order record as part of our
            compliance documentation. See our{" "}
            <Link href="/terms" className="text-teal underline">
              Terms of Sale
            </Link>{" "}
            for the full customer warranty.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-4">Quality and lot traceability</h2>
          <p>
            Every product we ship is traceable to a specific lot, a specific manufacturer Certificate
            of Analysis (COA), and a specific customer certification. COAs are published per-lot and
            linked from every product page. HPLC and mass spectrometry identity/purity data accompany
            every lot.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-4">Shipping</h2>
          <p>
            US domestic shipping only. All peptides shipped in cold-chain packaging where appropriate,
            with RUO declaration cards enclosed.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-4">Contact</h2>
          <p>
            Regulatory and compliance inquiries:{" "}
            <a href="mailto:admin@benchgradepeptides.com" className="text-teal underline">
              admin@benchgradepeptides.com
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}
