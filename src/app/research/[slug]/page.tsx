import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { Breadcrumb } from "@/components/ui";
import { RESEARCH_ARTICLES, type ResearchArticle } from "@/lib/research/articles";
import { PRODUCTS } from "@/lib/catalogue/data";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return RESEARCH_ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const a = RESEARCH_ARTICLES.find((x) => x.slug === slug);
  if (!a) return { title: "Citation not found", robots: { index: false } };
  const canonical = `/research/${a.slug}`;
  return {
    title: `${a.title.slice(0, 80)}`,
    description: a.summary,
    alternates: { canonical },
    openGraph: {
      title: `${a.title} · Bench Grade Peptides Research`,
      description: a.summary,
      url: canonical,
      type: "article",
    },
    twitter: {
      card: "summary",
      title: a.title,
      description: a.summary,
    },
  };
}

const CLASS_LABELS: Record<ResearchArticle["compound_class"], string> = {
  glp1: "GLP-1 family",
  "bpc-tb": "BPC-157 + TB-500",
  "gh-secretagogue": "GH secretagogues",
  "tissue-repair": "Tissue repair",
  neuropeptide: "Neuropeptides",
  longevity: "Longevity",
  "sexual-wellness": "Sexual wellness",
  immune: "Immune",
};

export default async function ResearchArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = RESEARCH_ARTICLES.find((a) => a.slug === slug);
  if (!article) notFound();

  // Map compound_slugs back to catalog products so we can link to the
  // PDPs the citation is actually talking about.
  const referencedProducts = article.compound_slugs
    .map((s) => PRODUCTS.find((p) => p.slug === s))
    .filter((p): p is (typeof PRODUCTS)[number] => Boolean(p));

  // Schema.org Article markup — gives the SERP a rich card with
  // author, date published, journal name (as `publisher`).
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: article.title,
    author: article.authors.split(",").map((name) => ({
      "@type": "Person",
      name: name.trim(),
    })),
    datePublished: `${article.year}-01-01`,
    publisher: { "@type": "Organization", name: article.journal },
    citation: article.url,
    isPartOf: {
      "@type": "PublicationIssue",
      isPartOf: { "@type": "Periodical", name: article.journal },
    },
    sameAs: [article.url],
  };

  // Sibling citations for "More in this class" — three more from the
  // same class, excluding the current one.
  const siblings = RESEARCH_ARTICLES.filter(
    (a) => a.compound_class === article.compound_class && a.slug !== article.slug,
  ).slice(0, 3);

  return (
    <div className="bg-paper">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />
      <article className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-10 py-10 sm:py-14 lg:py-20">
        <Breadcrumb
          items={[
            { label: "Home", href: "/" },
            { label: "Research", href: "/research" },
            { label: article.title.slice(0, 40) },
          ]}
        />

        <header className="mt-6 mb-8 sm:mb-12 border-b rule pb-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="label-eyebrow text-gold-dark text-[11px]">
              {CLASS_LABELS[article.compound_class]}
            </span>
            {article.is_pet_animal && (
              <span className="text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 bg-wine/10 text-wine border border-wine/30">
                Companion animal
              </span>
            )}
            {article.is_animal_study && !article.is_pet_animal && (
              <span className="text-[10px] uppercase tracking-[0.1em] px-2 py-0.5 bg-ink-muted/15 text-ink-muted">
                Preclinical
              </span>
            )}
          </div>
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl text-ink leading-tight mb-4">
            {article.title}
          </h1>
          <div className="text-sm font-mono-data text-ink-muted">
            {article.authors} · <span className="text-ink">{article.journal}</span> · {article.year}
          </div>
          {(article.pmid || article.doi) && (
            <div className="text-xs font-mono-data text-ink-muted mt-2">
              {article.pmid && <span>PMID: {article.pmid}</span>}
              {article.pmid && article.doi && <span> · </span>}
              {article.doi && <span>DOI: {article.doi}</span>}
            </div>
          )}
        </header>

        <section className="mb-10">
          <div className="label-eyebrow text-ink-muted mb-3">Summary</div>
          <p className="text-base sm:text-lg text-ink leading-relaxed">
            {article.summary}
          </p>
        </section>

        <section className="mb-10 border-t rule pt-6">
          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 h-12 px-6 bg-wine text-paper text-sm tracking-[0.04em] hover:bg-ink transition-colors"
          >
            Read the full citation on PubMed
            <ExternalLink className="w-4 h-4" aria-hidden />
          </a>
          <p className="text-[11px] text-ink-muted mt-3 max-w-prose">
            Citation hosted by NCBI. We link to the source so the
            researcher can read the abstract, full text, or
            references-cited list directly.
          </p>
        </section>

        {referencedProducts.length > 0 && (
          <section className="mb-10 border-t rule pt-6">
            <div className="label-eyebrow text-ink-muted mb-4">
              Compounds referenced in this study
            </div>
            <ul className="space-y-3">
              {referencedProducts.map((p) => (
                <li
                  key={p.slug}
                  className="border rule bg-paper-soft p-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <div className="font-display text-base text-ink">{p.name}</div>
                    <div className="text-xs text-ink-muted truncate">
                      {p.summary}
                    </div>
                  </div>
                  <Link
                    href={`/catalogue/${p.category_slug}/${p.slug}`}
                    className="text-sm text-gold hover:underline whitespace-nowrap"
                  >
                    View product →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {siblings.length > 0 && (
          <section className="border-t rule pt-6">
            <div className="label-eyebrow text-ink-muted mb-4">
              More {CLASS_LABELS[article.compound_class]} citations
            </div>
            <ul className="space-y-3">
              {siblings.map((s) => (
                <li key={s.slug}>
                  <Link
                    href={`/research/${s.slug}`}
                    className="block border rule bg-paper hover:bg-paper-soft p-4 transition-colors"
                  >
                    <div className="font-display text-sm text-ink leading-snug line-clamp-2">
                      {s.title}
                    </div>
                    <div className="text-[11px] font-mono-data text-ink-muted mt-1">
                      {s.journal} · {s.year}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-10">
          <Link href="/research" className="text-sm text-gold hover:underline">
            ← Back to research index
          </Link>
        </div>
      </article>
    </div>
  );
}
