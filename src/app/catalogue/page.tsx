import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumb, Callout } from "@/components/ui";
import { CatalogueBrowser } from "@/components/catalogue/CatalogueBrowser";
import { PopularStacks } from "@/components/catalogue/PopularStacks";
import { CATEGORIES, PRODUCTS } from "@/lib/catalogue/data";

export const metadata: Metadata = {
  title: "Catalog",
  description:
    "The full Bench Grade catalog. Research-grade synthetic peptides, HPLC-verified per lot, sold for laboratory research use only.",
  alternates: { canonical: "/catalogue" },
  openGraph: {
    title: "Catalog · Bench Grade Peptides",
    description: "Research-grade synthetic peptides. HPLC-verified per lot.",
    url: "/catalogue",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Catalog · Bench Grade Peptides",
    description: "Research-grade synthetic peptides. HPLC-verified per lot.",
  },
};

export default function CatalogPage() {
  return (
    <div className="bg-paper">
      <div className="max-w-[1480px] mx-auto px-5 sm:px-6 lg:px-10 py-8 sm:py-12 lg:py-16">
        <Breadcrumb items={[{ label: "Home", href: "/" }, { label: "Catalog" }]} />

        {/* User direct ask: "Too much wording below title" — header now
            carries the eyebrow + title only. RUO legal copy stays in
            the callout below. */}
        <header className="mt-4 sm:mt-6 mb-6 sm:mb-12 border-b rule pb-6 sm:pb-12">
          <div className="font-ui uppercase text-[10px] sm:text-xs tracking-[0.22em] font-bold text-gold-dark mb-2 sm:mb-4">
            The Catalog
          </div>
          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl text-wine leading-[1.08] sm:leading-[1.05] tracking-tight font-semibold">
            Research peptides, by the vial.
          </h1>
        </header>

        <Callout variant="ruo" title="Research use only" className="mb-6 sm:mb-12">
          All products on this catalog are sold for laboratory research use only. Not for human or
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
