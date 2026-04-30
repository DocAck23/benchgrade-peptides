"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { ProductCard } from "@/components/catalogue/ProductCard";
import type { CatalogProduct, CatalogCategory } from "@/lib/catalogue/data";
import { sendAnalyticsEvent } from "@/lib/analytics/client";

interface CatalogueBrowserProps {
  categories: CatalogCategory[];
  products: CatalogProduct[];
  /**
   * Rendered above the filtered category grid in the main column —
   * gets the sidebar treatment alongside it. Lets the page hand in a
   * server-rendered <PopularStacks /> so the sidebar sticks for
   * BOTH the popular stacks block + the category grid below it.
   */
  topSlot?: React.ReactNode;
}

/**
 * Client-side catalogue browser. Renders a left sidebar (search +
 * category include/exclude checkboxes) and a responsive grid that
 * shows 5-per-row on lg+ desktops. Defaults: search empty, every
 * category included.
 *
 * Filtering is purely cosmetic — server-side state is unchanged.
 */
export function CatalogueBrowser({
  categories,
  products,
  topSlot,
}: CatalogueBrowserProps) {
  const [query, setQuery] = useState("");
  const [enabledCategories, setEnabledCategories] = useState<Set<string>>(
    () => new Set(categories.map((c) => c.slug)),
  );

  const filteredByCategory = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .filter((c) => enabledCategories.has(c.slug))
      .map((category) => {
        const matches = products.filter((p) => {
          if (p.category_slug !== category.slug) return false;
          if (!q) return true;
          return (
            p.name.toLowerCase().includes(q) ||
            p.summary.toLowerCase().includes(q) ||
            p.molecular_formula?.toLowerCase().includes(q) ||
            p.variants.some((v) => v.sku.toLowerCase().includes(q))
          );
        });
        return { category, matches };
      })
      .filter((g) => g.matches.length > 0);
  }, [categories, products, enabledCategories, query]);

  const totalShown = filteredByCategory.reduce(
    (s, g) => s + g.matches.length,
    0,
  );

  // Search-event emission. Debounced so a visitor typing "abc" → "abcd"
  // → "abcde" emits a single event for "abcde" rather than three
  // separate ones. We also drop empty queries (the cleared state) and
  // queries shorter than two characters — too noisy to be useful.
  // The lastEmittedRef prevents re-emitting the same term if the user
  // tabs away and back without changing the input.
  const lastEmittedRef = useRef<string | null>(null);
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    if (trimmed === lastEmittedRef.current) return;
    const timer = window.setTimeout(() => {
      lastEmittedRef.current = trimmed;
      void sendAnalyticsEvent("product_search", {
        properties: {
          term: trimmed.slice(0, 100),
          results_count: totalShown,
        },
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [query, totalShown]);

  const toggle = (slug: string) => {
    setEnabledCategories((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const allOn = enabledCategories.size === categories.length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6 lg:gap-10">
      {/* Sidebar — sticky to the viewport top so it stays in place
          while the visitor scrolls past PopularStacks AND the
          filtered category grid. Top offset (28 = 112px) leaves
          room for the wine header when it's visible; when the
          header auto-hides on scroll-down, the sidebar's natural
          position covers the gap. */}
      <aside className="lg:sticky lg:top-28 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto pr-1">
        <div className="border rule bg-paper-soft p-4 mb-4">
          <label className="block">
            <span className="label-eyebrow text-ink-muted mb-2 block text-[10px]">
              Search catalogue
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
                placeholder="GLP-1, BPC-157, IGF-1..."
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

        <div className="border rule bg-paper-soft p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="label-eyebrow text-ink-muted text-[10px]">
              Categories
            </span>
            <button
              type="button"
              onClick={() =>
                setEnabledCategories(
                  allOn ? new Set() : new Set(categories.map((c) => c.slug)),
                )
              }
              className="text-[11px] text-gold hover:underline"
            >
              {allOn ? "Clear all" : "Select all"}
            </button>
          </div>
          <ul className="space-y-2">
            {categories.map((c) => {
              const checked = enabledCategories.has(c.slug);
              const count = products.filter(
                (p) => p.category_slug === c.slug,
              ).length;
              if (count === 0) return null;
              return (
                <li key={c.slug}>
                  <label className="flex items-center justify-between gap-3 cursor-pointer text-sm text-ink-soft hover:text-ink">
                    <span className="flex items-center gap-2 min-w-0">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(c.slug)}
                        className="w-4 h-4 accent-wine cursor-pointer shrink-0"
                      />
                      <span className="truncate">{c.name}</span>
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

        <div className="mt-4 text-[11px] text-ink-muted">
          Showing <span className="font-mono-data text-ink">{totalShown}</span>{" "}
          of {products.length} compounds
        </div>
      </aside>

      {/* Right column — popular stacks slot on top, then filtered grid */}
      <div>
        {/* Section nav chips — quick-jump to each catalogue section.
            User direct ask: "we can also have catalog buttons to be
            able to go through the different sections of the catalogue.
            we can scroll all the way through, and we can also click on
            'popular stacks', 'build your own stack', 'growth hormone
            axis', etc". Horizontal scroll on mobile, wraps on desktop.
            All anchor IDs match the section IDs rendered below + in
            <PopularStacks />. */}
        <nav
          aria-label="Catalogue sections"
          className="mb-6 sm:mb-8 -mx-1 sm:mx-0"
        >
          <ul className="flex flex-nowrap sm:flex-wrap gap-2 sm:gap-2.5 overflow-x-auto sm:overflow-visible px-1 sm:px-0 pb-2 sm:pb-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {topSlot && (
              <li>
                <a
                  href="#popular-stacks"
                  className="inline-flex items-center whitespace-nowrap rounded-pill border border-gold-dark/40 bg-paper-soft text-wine px-3.5 py-1.5 text-[11px] sm:text-xs font-ui font-bold uppercase tracking-[0.10em] hover:bg-gold/15 hover:border-gold transition-colors"
                >
                  Popular stacks
                </a>
              </li>
            )}
            <li>
              <Link
                href="/catalogue/stacks/build"
                className="inline-flex items-center whitespace-nowrap rounded-pill border border-gold-dark/40 bg-paper-soft text-wine px-3.5 py-1.5 text-[11px] sm:text-xs font-ui font-bold uppercase tracking-[0.10em] hover:bg-gold/15 hover:border-gold transition-colors"
              >
                Build your own
              </Link>
            </li>
            {filteredByCategory.map(({ category }) => (
              <li key={category.slug}>
                <a
                  href={`#cat-${category.slug}`}
                  className="inline-flex items-center whitespace-nowrap rounded-pill border border-rule bg-paper text-ink-soft px-3.5 py-1.5 text-[11px] sm:text-xs font-ui font-medium hover:text-wine hover:border-gold transition-colors"
                >
                  {category.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {topSlot}
        {filteredByCategory.length === 0 ? (
          <div className="border rule bg-paper-soft p-8 text-center">
            <p className="text-sm text-ink-soft">
              No compounds match these filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setEnabledCategories(new Set(categories.map((c) => c.slug)));
              }}
              className="mt-4 inline-flex items-center h-10 px-5 border border-ink text-sm hover:bg-ink hover:text-paper"
            >
              Reset filters
            </button>
          </div>
        ) : (
          filteredByCategory.map(({ category, matches }) => (
            <section
              key={category.slug}
              id={`cat-${category.slug}`}
              className="mb-12 sm:mb-16 scroll-mt-24"
              aria-labelledby={`cat-${category.slug}-h`}
            >
              <div className="flex items-end justify-between gap-3 sm:gap-4 mb-4 sm:mb-6 border-b rule pb-3 sm:pb-4">
                <div>
                  <div className="label-eyebrow text-ink-muted mb-1 sm:mb-2 text-[10px] sm:text-xs">
                    {category.taxonomy_label}
                  </div>
                  <h2
                    id={`cat-${category.slug}-h`}
                    className="font-display text-xl sm:text-2xl lg:text-3xl text-ink leading-tight"
                  >
                    {category.name}
                  </h2>
                </div>
                <Link
                  href={`/catalogue/${category.slug}`}
                  className="inline-flex items-center min-h-11 px-2 text-xs sm:text-sm text-gold hover:underline whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  {matches.length} →
                </Link>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3 lg:gap-4">
                {matches.map((product) => (
                  <ProductCard
                    key={product.slug}
                    product={product}
                    categorySlug={category.slug}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
