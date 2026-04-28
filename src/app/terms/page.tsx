import type { Metadata } from "next";
import { RUO_STATEMENTS } from "@/lib/compliance";

/** Effective date for these Terms of Sale. Hardcoded constant — NOT computed at
 *  build time. Update explicitly with a new commit whenever the terms change.
 *  Legal-document convention: dates are document data, not deployment data. */
const TERMS_EFFECTIVE_DATE = "April 22, 2026";

export const metadata: Metadata = {
  title: "Terms of Sale",
  description:
    "Terms of Sale for Bench Grade Peptides LLC: RUO certification, no warranty for human/animal use, payment, shipping, limitation of liability.",
  alternates: { canonical: "/terms" },
  openGraph: {
    title: "Terms of Sale · Bench Grade Peptides",
    description:
      "Research-use-only certification, payment, shipping, and limitation of liability.",
    url: "/terms",
    type: "website",
  },
};

export default function TermsPage() {
  return (
    <article className="max-w-3xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
      <div className="label-eyebrow text-ink-muted mb-6">Legal</div>
      <h1 className="font-display text-5xl lg:text-6xl leading-tight text-ink mb-4">
        Terms of Sale
      </h1>
      <p className="label-eyebrow text-ink-muted mb-12">Effective: {TERMS_EFFECTIVE_DATE}</p>

      <div className="space-y-8 text-ink-soft text-base leading-relaxed">
        <section>
          <h2 className="font-display text-2xl text-ink mb-3">1. Acceptance</h2>
          <p>
            These Terms of Sale govern all purchases from Bench Grade Peptides LLC ("Bench Grade,"
            "we," "us"). By placing an order, customer ("Customer," "you") accepts these terms in full.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-3">2. Research-use-only certification</h2>
          <p className="mb-3">{RUO_STATEMENTS.banner}</p>
          <p className="mb-3">At checkout, Customer certifies and warrants each of the following:</p>
          <ul className="list-disc ml-5 space-y-2">
            <li>Customer is 21 years of age or older.</li>
            <li>Customer is a researcher, scientist, or representative of a research institution.</li>
            <li>Customer will use the products solely for in vitro research purposes.</li>
            <li>Customer will not administer any product to humans or animals.</li>
            <li>Customer will not resell any product for consumption by humans or animals.</li>
            <li>Customer understands these products are not drugs, supplements, or medical devices.</li>
            <li>Customer understands these products have not been evaluated or approved by the FDA for any use other than laboratory research.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-3">3. No warranty of fitness for human or animal use</h2>
          <p>
            PRODUCTS ARE PROVIDED AS-IS. BENCH GRADE MAKES NO WARRANTY, EXPRESS OR IMPLIED, OF FITNESS
            FOR ANY USE OTHER THAN IN VITRO LABORATORY RESEARCH. ALL IMPLIED WARRANTIES OF MERCHANTABILITY
            AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-3">4. Indemnification</h2>
          <p>
            Customer agrees to indemnify, defend, and hold harmless Bench Grade, its officers,
            employees, and affiliates from any claim, loss, liability, or expense arising from
            Customer's use or misuse of any product, including any claim arising from administration
            of a product to humans or animals.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-3">5. Payment</h2>
          <p>
            Orders are paid via ACH, bank wire, or company check. Orders are not processed until cleared
            payment is received. Payment instructions are provided at checkout and by email.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-3">6. Shipping</h2>
          <p>
            US domestic shipping only. Customer is responsible for providing accurate shipping
            information. Risk of loss transfers to Customer upon carrier pickup. Bench Grade may
            require shipment to business addresses for certain products or order volumes.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-3">7. All sales final</h2>
          <p>
            Consistent with research-reagent industry practice, all sales are final. No refunds or
            returns on opened product. Damaged or incorrect shipments must be reported within 48 hours
            of delivery with photographic evidence; replacement at our discretion.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-3">8. Limitation of liability</h2>
          <p>
            BENCH GRADE'S TOTAL LIABILITY FOR ANY CLAIM ARISING FROM AN ORDER IS LIMITED TO THE PURCHASE
            PRICE OF THE AFFECTED PRODUCT. BENCH GRADE IS NOT LIABLE FOR INDIRECT, INCIDENTAL,
            CONSEQUENTIAL, OR PUNITIVE DAMAGES.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-3">9. Governing law and venue</h2>
          <p>
            These Terms are governed by the laws of the State of Delaware, without regard to
            conflict-of-laws principles. Disputes shall be resolved by binding arbitration
            administered by JAMS in accordance with its rules. Venue: Delaware.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-3">10. Contact</h2>
          <p>
            Questions about these Terms:{" "}
            <a href="mailto:admin@benchgradepeptides.com" className="text-teal underline">
              admin@benchgradepeptides.com
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}
