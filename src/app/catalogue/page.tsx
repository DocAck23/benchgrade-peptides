import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb, Callout } from "@/components/ui";
import { CatalogueBrowser } from "@/components/catalogue/CatalogueBrowser";
import { PopularStacks } from "@/components/catalogue/PopularStacks";
import { CATEGORIES, PRODUCTS } from "@/lib/catalogue/data";

export const metadata: Metadata = {
  title: "Catalog",
  description:
    "Full catalogue of research-grade synthetic peptides. HPLC-verified purity, COA per lot, for laboratory research use only.",
  alternates: { canonical: "/catalogue" },
  openGraph: {
    title: "Catalogue · Bench Grade Peptides",
    description:
      "Full catalogue of research-grade synthetic peptides. HPLC-verified purity, COA per lot.",
    url: "/catalogue",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Catalogue · Bench Grade Peptides",
    description:
      "Research-grade synthetic peptides. HPLC-verified purity, COA per lot.",
  },
};

export default function CatalogPage() {
  return (
    <div className="bg-paper">
      <div className="max-w-[1480px] mx-auto px-5 sm:px-6 lg:px-10 py-8 sm:py-12 lg:py-16">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Catalog" }]} />

        <header className="mt-4 sm:mt-6 mb-6 sm:mb-12 border-b rule pb-6 sm:pb-12">
          <div className="label-eyebrow text-ink-muted mb-2 sm:mb-4 text-[10px] sm:text-xs">Full catalogue</div>
          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl text-ink leading-[1.08] sm:leading-[1.05] mb-3 sm:mb-6">
            Research-grade synthetic peptides.
          </h1>
          <p className="text-sm sm:text-base lg:text-lg text-ink-soft max-w-2xl leading-relaxed">
            Lyophilized powder, individual peptides only. HPLC + MS verified, certificate of analysis
            published per lot, cold-chain domestic shipping. Supplied for laboratory research use only —
            not drugs, supplements, or medical devices.
          </p>
        </header>

        <Callout variant="ruo" title="Research use only" className="mb-6 sm:mb-12">
          All products on this catalogue are supplied for laboratory research use only. Not for human or
          veterinary use. Not a drug, supplement, or medical device. Customer certification is required at
          checkout per our{" "}
          <Link href="/terms" className="text-gold underline">Terms of Sale</Link>.
        </Callout>

        {/* Browser: sticky sidebar search + checkbox filters + 5-per-row
            grid. PopularStacks renders inside the right column so the
            sidebar stays in view through the entire catalogue browse. */}
        <CatalogueBrowser
          categories={[...CATEGORIES]}
          products={[...PRODUCTS]}
          topSlot={<PopularStacks />}
        />
      </div>
    </div>
  );
}
