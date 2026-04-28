"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, ExternalLink } from "lucide-react";
import type {
  ResearchArticle,
  ResearchClass,
} from "@/lib/research/articles";

interface ResearchBrowserProps {
  articles: readonly ResearchArticle[];
}

const CLASS_LABELS: Record<ResearchClass, string> = {
  glp1: "GLP-1 family",
  "bpc-tb": "BPC-157 + TB-500",
  "gh-secretagogue": "GH secretagogues",
  "tissue-repair": "Tissue repair",
  neuropeptide: "Neuropeptides",
  longevity: "Longevity",
  "sexual-wellness": "Sexual wellness",
  immune: "Immune",
};

const CLASS_ORDER: ResearchClass[] = [
  "glp1",
  "bpc-tb",
  "gh-secretagogue",
  "tissue-repair",
  "neuropeptide",
  "longevity",
  "sexual-wellness",
  "immune",
];

/**
 * Filterable research-literature browser — mirrors CatalogueBrowser
 * (sidebar with search box + checkbox class filters, right-column
 * uniform-card grid). Pure client-side cosmetic filtering against
 * the static articles catalog.
 */
export function ResearchBrowser({ articles }: ResearchBrowserProps) {
  const [query, setQuery] = useState("");
  const [enabled, setEnabled] = useState<Set<ResearchClass>>(
    () => new Set(CLASS_ORDER),
  );
  const [petOnly, setPetOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((a) => {
      if (!enabled.has(a.compound_class)) return false;
      if (petOnly && !a.is_pet_animal) return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.authors.toLowerCase().includes(q) ||
        a.journal.toLowerCase().includes(q) ||
        a.compound_slugs.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [articles, enabled, query, petOnly]);

  const toggle = (cls: ResearchClass) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls);
      else next.add(cls);
      return next;
    });
  };
  const allOn = enabled.size === CLASS_ORDER.length;

  // Counts per class — computed from the FULL catalog (so the
  // sidebar always reads "GH secretagogues 10" even if the user has
  // narrowed the visible list with search).
  const countsByClass = useMemo(() => {
    const m = new Map<ResearchClass, number>();
    for (const a of articles) {
      m.set(a.compound_class, (m.get(a.compound_class) ?? 0) + 1);
    }
    return m;
  }, [articles]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6 lg:gap-10">
      {/* Sidebar */}
      <aside className="lg:sticky lg:top-28 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto pr-1">
        <div className="border rule bg-paper-soft p-4 mb-4">
          <label className="block">
            <span className="label-eyebrow text-ink-muted mb-2 block text-[10px]">
              Search literature
            </span>
            <div className="relative">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none"
                strokeWidth={1.5}
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Author, journal, compound..."
                className="w-full h-10 pl-9 pr-9 border rule bg-paper text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:border-ink"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 inline-flex items-center justify-center text-ink-muted hover:text-ink"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={1.75} />
                </button>
              )}
            </div>
          </label>
        </div>

        <div className="border rule bg-paper-soft p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="label-eyebrow text-ink-muted text-[10px]">
              Compound class
            </span>
            <button
              type="button"
              onClick={() =>
                setEnabled(allOn ? new Set() : new Set(CLASS_ORDER))
              }
              className="text-[11px] text-teal hover:underline"
            >
              {allOn ? "Clear all" : "Select all"}
            </button>
          </div>
          <ul className="space-y-2">
            {CLASS_ORDER.map((cls) => {
              const count = countsByClass.get(cls) ?? 0;
              if (count === 0) return null;
              const checked = enabled.has(cls);
              return (
                <li key={cls}>
                  <label className="flex items-center justify-between gap-3 cursor-pointer text-sm text-ink-soft hover:text-ink">
                    <span className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(cls)}
                        className="w-4 h-4 accent-wine cursor-pointer shrink-0"
                      />
                      <span className="truncate">{CLASS_LABELS[cls]}</span>
                    </span>
                    <span className="font-mono-data text-[11px] text-ink-muted">
                      {count}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="border rule bg-paper-soft p-4">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-ink-soft hover:text-ink">
            <input
              type="checkbox"
              checked={petOnly}
              onChange={(e) => setPetOnly(e.target.checked)}
              className="w-4 h-4 accent-wine cursor-pointer"
            />
            <span>Companion-animal studies only</span>
          </label>
        </div>

        <div className="mt-4 text-[11px] text-ink-muted">
          Showing <span className="font-mono-data text-ink">{filtered.length}</span>{" "}
          of {articles.length} citations
        </div>
      </aside>

      {/* Filtered grid */}
      <div>
        {filtered.length === 0 ? (
          <div className="border rule bg-paper-soft p-8 text-center">
            <p className="text-sm text-ink-soft">
              No citations match these filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setEnabled(new Set(CLASS_ORDER));
                setPetOnly(false);
              }}
              className="mt-4 inline-flex items-center h-10 px-5 border border-ink text-sm hover:bg-ink hover:text-paper"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
            {filtered.map((a) => (
              <li key={a.slug}>
                <ArticleCard article={a} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ArticleCard({ article }: { article: ResearchArticle }) {
  return (
    <article className="flex flex-col h-full bg-paper border rule p-5 hover:bg-paper-soft transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <span className="label-eyebrow text-[10px] text-gold-dark">
          {CLASS_LABELS[article.compound_class]}
        </span>
        {article.is_pet_animal && (
          <span className="text-[9px] uppercase tracking-[0.1em] px-2 py-0.5 bg-wine/10 text-wine border border-wine/30">
            Companion animal
          </span>
        )}
        {article.is_animal_study && !article.is_pet_animal && (
          <span className="text-[9px] uppercase tracking-[0.1em] px-2 py-0.5 bg-ink-muted/15 text-ink-muted">
            Preclinical
          </span>
        )}
      </div>

      <Link
        href={`/research/${article.slug}`}
        className="font-display text-base lg:text-lg text-ink leading-tight line-clamp-3 hover:underline mb-2 min-h-[3.6em]"
      >
        {article.title}
      </Link>

      <div className="text-[11px] font-mono-data text-ink-muted mb-3 truncate">
        {article.journal} · {article.year}
      </div>

      <p className="text-xs text-ink-soft leading-snug line-clamp-4 mb-4 flex-1">
        {article.summary}
      </p>

      <div className="mt-auto flex items-center justify-between pt-3 border-t rule">
        <Link
          href={`/research/${article.slug}`}
          className="text-xs text-teal hover:underline"
        >
          Read citation →
        </Link>
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-ink-muted hover:text-ink inline-flex items-center gap-1"
          aria-label={`Open ${article.title} on PubMed`}
        >
          PubMed
          <ExternalLink className="w-3 h-3" aria-hidden />
        </a>
      </div>
    </article>
  );
}
