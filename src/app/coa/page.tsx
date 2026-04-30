import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Certificates of Analysis",
  description:
    "Per-lot HPLC and mass spectrometry identity and purity verification for every Bench Grade Peptides product. COA ships in every box.",
  alternates: { canonical: "/coa" },
  openGraph: {
    title: "Certificates of Analysis · Bench Grade Peptides",
    description:
      "Per-lot HPLC + MS identity and purity verification on every product.",
    url: "/coa",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Certificates of Analysis · Bench Grade Peptides",
    description: "Per-lot HPLC + MS identity and purity verification.",
  },
};

export default function COAPage() {
  return (
    <article className="max-w-3xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
      <div className="label-eyebrow text-ink-muted mb-6">Quality</div>
      <h1 className="font-display text-5xl lg:text-6xl leading-tight text-ink mb-10">
        Certificates of Analysis.
      </h1>

      <div className="space-y-10 text-base text-ink-soft leading-relaxed">
        <section>
          <p className="text-lg text-ink leading-relaxed">
            Every product we ship is accompanied by a Certificate of Analysis verifying identity and
            purity for the specific lot in your vial.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-4">What's on a COA</h2>
          <ul className="list-disc ml-5 space-y-2">
            <li>Compound name, CAS number, molecular formula, molecular weight</li>
            <li>Lot number and manufacture date</li>
            <li>HPLC chromatogram with integrated peaks and identified purity percentage</li>
            <li>Mass spectrometry identity confirmation (MS/MS or LC-MS as applicable)</li>
            <li>Appearance, solubility, and storage recommendations</li>
            <li>Residual solvents and water content where measured</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-4">How to access yours</h2>
          <p>
            After your order ships, you'll receive a tracking email with a link to the Certificate of
            Analysis for the lot you received. The COA link is also available in your order record
            once you create an account. For past orders or archived COAs, email{" "}
            <a href="mailto:admin@benchgradepeptides.com" className="text-gold underline">
              admin@benchgradepeptides.com
            </a>{" "}
            with your order number.
          </p>
        </section>

        <section>
          <h2 className="font-display text-2xl text-ink mb-4">Third-party verification</h2>
          <p>
            Where feasible, we submit a random vial per lot for third-party identity and purity
            verification at an independent analytical laboratory. Results are retained in our internal
            quality record.
          </p>
        </section>
      </div>
    </article>
  );
}
