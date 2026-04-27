import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Bench Grade Peptides LLC.",
};

export default function ContactPage() {
  return (
    <article className="max-w-2xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
      <div className="label-eyebrow text-ink-muted mb-6">Contact</div>
      <h1 className="font-display text-5xl lg:text-6xl leading-tight text-ink mb-10">
        Contact.
      </h1>

      <div className="space-y-8 text-base text-ink-soft leading-relaxed">
        <section>
          <h2 className="label-eyebrow text-ink-muted mb-3">General &amp; orders</h2>
          <a href="mailto:admin@benchgradepeptides.com" className="text-xl text-teal underline">
            admin@benchgradepeptides.com
          </a>
        </section>

        <section>
          <h2 className="label-eyebrow text-ink-muted mb-3">Regulatory &amp; compliance</h2>
          <a href="mailto:admin@benchgradepeptides.com" className="text-xl text-teal underline">
            admin@benchgradepeptides.com
          </a>
        </section>

        <section>
          <h2 className="label-eyebrow text-ink-muted mb-3">Mailing address</h2>
          <address className="not-italic text-ink leading-relaxed">
            Bench Grade Peptides LLC<br />
            8 The Green<br />
            Dover, DE 19901<br />
            United States
          </address>
        </section>

        <section className="pt-8 border-t rule">
          <p className="text-sm text-ink-muted leading-relaxed">
            Bench Grade Peptides LLC is a United States limited liability company supplying
            research-grade synthetic peptides for laboratory research use only. Inquiries are typically
            answered within one business day, Monday–Friday, 9am–5pm CT.
          </p>
        </section>
      </div>
    </article>
  );
}
