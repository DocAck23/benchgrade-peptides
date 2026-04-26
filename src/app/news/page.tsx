import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb } from "@/components/ui";

export const metadata: Metadata = {
  title: "News",
  description:
    "Bench Grade Peptides news — new compound announcements, batch release notes, manufacturing updates, and industry developments.",
  alternates: { canonical: "/news" },
  openGraph: {
    title: "News · Bench Grade Peptides",
    description: "Compound releases, batch notes, manufacturing updates.",
    url: "/news",
    type: "website",
  },
};

export default function NewsPage() {
  return (
    <div className="bg-paper">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 py-12 sm:py-16 lg:py-20">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "News" }]} />

        <header className="mt-4 sm:mt-6 mb-10 sm:mb-16 border-b rule pb-6 sm:pb-12">
          <div className="label-eyebrow text-ink-muted mb-2 sm:mb-4 text-[10px] sm:text-xs">News</div>
          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl text-ink leading-[1.08] sm:leading-[1.05] mb-3 sm:mb-6">
            Bench updates.
          </h1>
          <p
            className="text-base sm:text-lg lg:text-xl italic text-ink-soft max-w-2xl leading-relaxed"
            style={{ fontFamily: "var(--font-editorial)" }}
          >
            New compound releases, batch notes, and manufacturing updates from
            our US lab.
          </p>
        </header>

        <section className="border border-rule bg-paper-soft p-8 sm:p-12 text-center">
          <div className="label-eyebrow text-gold-dark mb-3">First post coming soon</div>
          <h2 className="font-display text-2xl sm:text-3xl text-ink mb-4">
            Quiet by design.
          </h2>
          <p className="text-ink-soft max-w-xl mx-auto mb-6 leading-relaxed">
            We post here when there&rsquo;s something material to share — a new
            compound clearing QA, an improved synthesis route, an updated
            certificate template. No filler.
          </p>
          <Link
            href="/catalogue"
            className="inline-flex items-center h-12 px-8 bg-wine text-paper text-sm tracking-[0.04em] hover:bg-gold-dark transition-colors"
          >
            Browse the catalogue
          </Link>
        </section>
      </div>
    </div>
  );
}
