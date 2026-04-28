import type { Metadata } from "next";
import { Breadcrumb } from "@/components/ui";
import { ResearchBrowser } from "@/components/research/ResearchBrowser";
import { RESEARCH_ARTICLES } from "@/lib/research/articles";

export const metadata: Metadata = {
  title: "Research",
  description:
    "Long-form research articles on peptide synthesis, HPLC verification methods, lot-traceability, and the science behind Bench Grade compounds.",
  alternates: { canonical: "/research" },
  openGraph: {
    title: "Research · Bench Grade Peptides",
    description:
      "Long-form research articles on peptide science, synthesis, and verification.",
    url: "/research",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Research · Bench Grade Peptides",
    description:
      "Long-form research articles on peptide science, synthesis, and verification.",
  },
};

export default function ResearchPage() {
  return (
    <div className="bg-paper">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-6 lg:px-10 py-12 sm:py-16 lg:py-20">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Research" }]} />

        <header className="mt-4 sm:mt-6 mb-10 sm:mb-16 border-b rule pb-6 sm:pb-12">
          <div className="label-eyebrow text-ink-muted mb-2 sm:mb-4 text-[10px] sm:text-xs">Research articles</div>
          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl text-ink leading-[1.08] sm:leading-[1.05] mb-3 sm:mb-6">
            The science behind every vial.
          </h1>
          <p
            className="text-base sm:text-lg lg:text-xl italic text-ink-soft max-w-2xl leading-relaxed"
            style={{ fontFamily: "var(--font-editorial)" }}
          >
            Synthesis methodology, HPLC + MS verification, lot traceability, and
            the published research behind the compounds in our catalogue.
          </p>
        </header>

        <ResearchBrowser articles={RESEARCH_ARTICLES} />
      </div>
    </div>
  );
}
