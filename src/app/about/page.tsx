import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description:
    "Bench Grade Peptides LLC — a research chemical distributor supplying synthetic peptides for laboratory research use only.",
};

export default function AboutPage() {
  return (
    <article className="max-w-3xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
      <div className="label-eyebrow text-ink-muted mb-6">About</div>
      <h1 className="font-display text-5xl lg:text-6xl leading-tight text-ink mb-10">
        Research-grade synthetic peptides, assembled as a reference catalog.
      </h1>

      <div className="space-y-10 text-base text-ink-soft leading-relaxed">
        <section>
          <p className="text-lg text-ink leading-relaxed">
            Bench Grade Peptides LLC is a specialty research-chemical distributor. We supply
            lyophilized synthetic peptides to laboratories, research institutions, and qualified
            researchers across the United States.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-4">What we do</h2>
          <p>
            We source pharmaceutical-grade synthetic peptide APIs from audited contract manufacturers,
            verify every lot via HPLC and mass spectrometry, and publish per-lot Certificates of
            Analysis with every product. Each outbound vial is traceable to its lot number, COA version,
            and customer certification record.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-4">What we don't do</h2>
          <p>
            We do not compound. We do not dispense. We do not advise on administration. We are not a
            pharmacy, a dietary supplement company, or a medical device manufacturer. Our products are
            supplied for laboratory research use only and are not evaluated by the FDA for any other use.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-4">Contact</h2>
          <p>
            Email:{" "}
            <a href="mailto:admin@benchgradepeptides.com" className="text-teal underline">
              admin@benchgradepeptides.com
            </a>
          </p>
        </section>
      </div>
    </article>
  );
}
