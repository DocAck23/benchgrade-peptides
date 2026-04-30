"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  Minus,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type {
  CatalogCategory,
  CatalogProduct,
  CatalogVariant,
} from "@/lib/catalogue/data";
import { useCart } from "@/lib/cart/CartContext";
import { formatPrice, cn } from "@/lib/utils";
import { RevealOnScroll } from "@/components/ui/RevealOnScroll";
import {
  saveStack,
  deleteSavedStack,
  loadSavedStack,
} from "@/app/actions/saved-stacks";
import type { SavedStackLine, SavedStackRow } from "@/lib/supabase/types";

// ----------------------------------------------------------------------------
// Constants tuned to match server-side limits + cart caps.
// ----------------------------------------------------------------------------
const DRAFT_STORAGE_KEY = "bgp.stack-builder.draft.v1";
const MAX_LINES = 20;
const MAX_QTY = 20;
const STACK_SAVE_THRESHOLD = 3; // free shipping kicks in too at $150 separately
const FREE_SHIPPING_THRESHOLD_CENTS = 15_000;

// ----------------------------------------------------------------------------
// State helpers
// ----------------------------------------------------------------------------

interface BuilderLine {
  sku: string;
  size_mg: number;
  quantity: number;
}

interface DraftShape {
  name: string;
  lines: BuilderLine[];
  /** id of the saved stack this draft was loaded from, if any */
  saved_stack_id: string | null;
}

const EMPTY_DRAFT: DraftShape = {
  name: "My custom stack",
  lines: [],
  saved_stack_id: null,
};

function readDraft(): DraftShape {
  if (typeof window === "undefined") return EMPTY_DRAFT;
  try {
    // localStorage rather than sessionStorage so the in-progress
    // composition survives a magic-link sign-in tab change (codex
    // caught this — sessionStorage is per-tab so the click-through
    // from the email lands a fresh tab with no draft). Tradeoff:
    // a stale draft persists across sessions; the visible "Clear
    // stack" button on the right panel is the customer's escape hatch.
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed = JSON.parse(raw) as Partial<DraftShape>;
    if (!parsed || typeof parsed !== "object") return EMPTY_DRAFT;
    const rawName =
      typeof parsed.name === "string" && parsed.name.trim().length > 0
        ? parsed.name
        : EMPTY_DRAFT.name;
    return {
      // Hard-clamp the name on read in case localStorage was
      // tampered with (or a future migration relaxed the input
      // limit) — the server schema accepts up to 100 chars.
      name: rawName.slice(0, 100),
      lines: Array.isArray(parsed.lines)
        ? parsed.lines
            .filter(
              (l): l is BuilderLine =>
                Boolean(l) &&
                typeof l.sku === "string" &&
                typeof l.size_mg === "number" &&
                typeof l.quantity === "number" &&
                Number.isFinite(l.quantity),
            )
            .slice(0, MAX_LINES)
        : [],
      saved_stack_id:
        typeof parsed.saved_stack_id === "string" ? parsed.saved_stack_id : null,
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

function writeDraft(draft: DraftShape): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    /* localStorage full / disabled — silent */
  }
}

function clearDraft(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    /* noop */
  }
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

interface StackBuilderProps {
  products: CatalogProduct[];
  categories: CatalogCategory[];
  isAuthed: boolean;
  initialSavedStacks: SavedStackRow[];
}

export function StackBuilder({
  products,
  categories,
  isAuthed,
  initialSavedStacks,
}: StackBuilderProps) {
  const router = useRouter();
  const { addItem } = useCart();

  // ── Builder state (rehydrated from sessionStorage on mount) ────────────
  const [draft, setDraft] = useState<DraftShape>(EMPTY_DRAFT);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setDraft(readDraft());
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (hydrated) writeDraft(draft);
  }, [draft, hydrated]);

  // ── Filter UI state ────────────────────────────────────────────────────
  // User direct ask (Praetorian /subscriptions reference): "have it so
  // the categories are to the left, and when you click them the
  // products and the pictures animate in." Single-select model with
  // null = "All compounds". Switching re-keys the product grid below
  // so RevealOnScroll fires fresh stagger on every category change.
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // ── Dialog / inline state ──────────────────────────────────────────────
  const [editingName, setEditingName] = useState(false);
  const [savedStacks, setSavedStacks] =
    useState<SavedStackRow[]>(initialSavedStacks);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmReplaceLoad, setConfirmReplaceLoad] = useState<string | null>(
    null,
  );
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // Auto-clear toast after 3.5s.
  const toastTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!info) return;
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setInfo(null), 3500);
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [info]);

  // ── Derived: filter products ───────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (selectedCategory && p.category_slug !== selectedCategory) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q) ||
        p.molecular_formula?.toLowerCase().includes(q) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(q))
      );
    });
  }, [products, selectedCategory, query]);

  const productCountByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) m.set(p.category_slug, (m.get(p.category_slug) ?? 0) + 1);
    return m;
  }, [products]);

  const selectedCategoryName = selectedCategory
    ? (categories.find((c) => c.slug === selectedCategory)?.name ?? "Compounds")
    : "All compounds";

  // ── Derived: stack details ─────────────────────────────────────────────
  const stackLines = useMemo(() => {
    return draft.lines
      .map((l) => {
        const product = products.find((p) =>
          p.variants.some((v) => v.sku === l.sku),
        );
        const variant = product?.variants.find((v) => v.sku === l.sku);
        if (!product || !variant) return null;
        return { line: l, product, variant };
      })
      .filter(
        (
          x,
        ): x is {
          line: BuilderLine;
          product: CatalogProduct;
          variant: CatalogVariant;
        } => x !== null,
      );
  }, [draft.lines, products]);

  const subtotalCents = useMemo(
    () =>
      stackLines.reduce(
        (s, { variant, line }) =>
          s + Math.round(variant.retail_price * 100) * line.quantity,
        0,
      ),
    [stackLines],
  );
  const totalVials = useMemo(
    () => stackLines.reduce((s, { line }) => s + line.quantity, 0),
    [stackLines],
  );
  const stackSaveUnlocked = totalVials >= STACK_SAVE_THRESHOLD;
  const freeShippingUnlocked = subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS;
  const freeShipShortCents = freeShippingUnlocked
    ? 0
    : FREE_SHIPPING_THRESHOLD_CENTS - subtotalCents;

  // ── Mutations ──────────────────────────────────────────────────────────
  const setName = (name: string) =>
    // Clamp to 100 chars even though the input has maxLength=100 —
    // a programmatic / paste path could outrun the attribute, and the
    // server schema rejects longer names anyway.
    setDraft((prev) => ({ ...prev, name: name.slice(0, 100) }));

  const upsertLine = (sku: string, size_mg: number, delta: number) => {
    setDraft((prev) => {
      const idx = prev.lines.findIndex((l) => l.sku === sku);
      if (idx === -1) {
        if (prev.lines.length >= MAX_LINES) {
          setError(`A stack can hold up to ${MAX_LINES} different items.`);
          return prev;
        }
        const qty = Math.min(MAX_QTY, Math.max(1, delta));
        return {
          ...prev,
          lines: [...prev.lines, { sku, size_mg, quantity: qty }],
        };
      }
      const next = [...prev.lines];
      const newQty = Math.max(0, Math.min(MAX_QTY, next[idx].quantity + delta));
      if (newQty <= 0) next.splice(idx, 1);
      else next[idx] = { ...next[idx], quantity: newQty };
      return { ...prev, lines: next };
    });
    setError(null);
  };

  const setLineQuantity = (sku: string, qty: number) => {
    // NaN guard — clearing the qty input gives `parseInt("", 10) = NaN`
    // which Math.max(0, NaN) propagates straight into state. Codex
    // caught this corrupting the rendered value to "$NaN." Treat
    // non-finite as a no-op so an in-progress edit doesn't trash
    // the line.
    if (!Number.isFinite(qty)) return;
    setDraft((prev) => {
      const idx = prev.lines.findIndex((l) => l.sku === sku);
      if (idx === -1) return prev;
      const clamped = Math.max(0, Math.min(MAX_QTY, qty));
      if (clamped <= 0) {
        const next = [...prev.lines];
        next.splice(idx, 1);
        return { ...prev, lines: next };
      }
      const next = [...prev.lines];
      next[idx] = { ...next[idx], quantity: clamped };
      return { ...prev, lines: next };
    });
    setError(null);
  };

  const removeLine = (sku: string) => {
    setDraft((prev) => ({
      ...prev,
      lines: prev.lines.filter((l) => l.sku !== sku),
    }));
  };

  const clearStack = () => {
    setDraft({ ...EMPTY_DRAFT });
    clearDraft();
  };

  const onAddToCart = () => {
    if (stackLines.length === 0) {
      setError("Add at least one vial first.");
      return;
    }
    for (const { product, variant, line } of stackLines) {
      addItem(product, variant, line.quantity);
    }
    setInfo(`Added ${totalVials} vials to your cart.`);
    clearStack();
  };

  const onSave = () => {
    if (!isAuthed) {
      router.push("/login?next=/catalogue/stacks/build");
      return;
    }
    if (stackLines.length === 0) {
      setError("Add at least one vial before saving.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await saveStack({
        id: draft.saved_stack_id ?? undefined,
        name: draft.name.trim(),
        lines: stackLines.map(({ line }) => ({
          sku: line.sku,
          quantity: line.quantity,
        })),
      });
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        return;
      }
      setInfo(`Saved as "${draft.name.trim()}".`);
      setDraft((prev) => ({
        ...prev,
        saved_stack_id: res.id ?? prev.saved_stack_id,
      }));
      // Refresh the saved-stacks rail so the new stack appears.
      router.refresh();
    });
  };

  const onLoadSaved = (stack: SavedStackRow) => {
    if (stackLines.length > 0 && confirmReplaceLoad !== stack.id) {
      setConfirmReplaceLoad(stack.id);
      return;
    }
    setConfirmReplaceLoad(null);
    setError(null);
    startTransition(async () => {
      const res = await loadSavedStack(stack.id);
      if (!res.ok || !res.stack) {
        setError(res.error ?? "Could not load.");
        return;
      }
      // Re-derive size_mg from the catalog so the builder UI has it
      // available without keeping it on the saved row.
      const lines: BuilderLine[] = [];
      for (const l of res.stack.lines) {
        const product = products.find((p) =>
          p.variants.some((v) => v.sku === l.sku),
        );
        const variant = product?.variants.find((v) => v.sku === l.sku);
        if (!product || !variant) continue;
        lines.push({
          sku: l.sku,
          size_mg: variant.size_mg,
          quantity: l.quantity,
        });
      }
      setDraft({
        name: res.stack.name,
        lines,
        saved_stack_id: res.stack.id,
      });
      if (res.stack.dropped_skus.length > 0) {
        setInfo(
          `Loaded "${res.stack.name}". ${res.stack.dropped_skus.length} item${
            res.stack.dropped_skus.length === 1 ? " was" : "s were"
          } no longer available and skipped.`,
        );
      } else {
        setInfo(`Loaded "${res.stack.name}".`);
      }
    });
  };

  const onDeleteSaved = (stack: SavedStackRow) => {
    if (confirmDelete !== stack.id) {
      setConfirmDelete(stack.id);
      return;
    }
    setConfirmDelete(null);
    startTransition(async () => {
      const res = await deleteSavedStack(stack.id);
      if (!res.ok) {
        setError(res.error ?? "Could not delete.");
        return;
      }
      setSavedStacks((prev) => prev.filter((s) => s.id !== stack.id));
      setInfo(`Deleted "${stack.name}".`);
      if (draft.saved_stack_id === stack.id) {
        setDraft((prev) => ({ ...prev, saved_stack_id: null }));
      }
    });
  };

  // Keep the local copy of saved stacks fresh after the parent
  // refreshes us with new server data.
  useEffect(() => {
    setSavedStacks(initialSavedStacks);
  }, [initialSavedStacks]);

  // Category list with an "All" pseudo-entry on top. Counts mirror the
  // sidebar's "12" hint so the user knows how many compounds live behind
  // each click before clicking.
  const categoryNavItems: { slug: string | null; name: string; count: number }[] = [
    { slug: null, name: "All compounds", count: products.length },
    ...categories
      .map((c) => ({
        slug: c.slug,
        name: c.name,
        count: productCountByCategory.get(c.slug) ?? 0,
      }))
      .filter((c) => c.count > 0),
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)_22rem] gap-6 lg:gap-8">
      {/* ============ Left: vertical category nav (Praetorian-style) ====== */}
      <aside
        aria-label="Stack builder categories"
        className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto"
      >
        <div className="label-eyebrow text-ink-muted text-[10px] mb-3 hidden lg:block">
          Categories
        </div>
        {/* Desktop: vertical list. Mobile: horizontal scroll chip rail. */}
        <ul
          className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-visible -mx-1 lg:mx-0 px-1 lg:px-0 pb-2 lg:pb-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        >
          {categoryNavItems.map((item) => {
            const isActive =
              (item.slug === null && selectedCategory === null) ||
              item.slug === selectedCategory;
            return (
              <li key={item.slug ?? "_all"} className="shrink-0 lg:shrink">
                <button
                  type="button"
                  onClick={() => setSelectedCategory(item.slug)}
                  aria-pressed={isActive}
                  className={cn(
                    "w-full text-left whitespace-nowrap lg:whitespace-normal flex items-baseline justify-between gap-2 transition-all duration-200",
                    "rounded-pill lg:rounded-md px-3.5 lg:px-3 py-1.5 lg:py-2.5",
                    "border lg:border-l-2 lg:border-r-0 lg:border-t-0 lg:border-b-0",
                    isActive
                      ? "bg-wine text-paper border-wine lg:bg-paper-soft lg:text-wine lg:border-l-wine font-bold"
                      : "bg-paper text-ink-soft border-rule lg:border-l-transparent hover:text-wine hover:lg:bg-paper-soft hover:lg:border-l-gold-dark",
                  )}
                >
                  <span className="text-[12px] lg:text-sm font-ui">{item.name}</span>
                  <span
                    className={cn(
                      "font-mono-data text-[10px] lg:text-[11px] tabular-nums",
                      isActive ? "opacity-90 lg:text-ink-muted" : "text-ink-muted",
                    )}
                  >
                    {item.count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ============ Middle: search + animated product grid ============== */}
      <section aria-label="Compounds">
        {/* Search row — slimmed; no chip filter, the sidebar handles
            category narrowing now. */}
        <div className="mb-5 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none"
              strokeWidth={1.5}
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${selectedCategoryName.toLowerCase()}…`}
              className="w-full h-11 pl-9 pr-9 border rule rounded-pill bg-paper text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:border-gold-dark focus-visible:ring-2 focus-visible:ring-gold/30"
            />
            {query && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 inline-flex items-center justify-center text-ink-muted hover:text-ink rounded-full"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>
          <span className="hidden sm:block font-mono-data text-[11px] text-ink-muted">
            {filteredProducts.length} shown
          </span>
        </div>

        {/* Section heading reflects the selected category — gives the
            click a visible reaction on top of the animated cards. */}
        <div className="mb-4 sm:mb-5 flex items-end justify-between gap-4">
          <div>
            <div className="label-eyebrow text-gold-dark text-[10px] sm:text-[11px] mb-1">
              {selectedCategory ? "Filtered to" : "Browse"}
            </div>
            <h2 className="font-display text-2xl sm:text-3xl text-wine leading-tight tracking-tight">
              {selectedCategoryName}
            </h2>
          </div>
        </div>

        {/* Praetorian-style progress strip — tells the user how their
            in-flight stack is shaping up, sitting right above the grid
            so each "Add" reads as visible momentum. */}
        <div className="mb-5 sm:mb-6 border rule rounded-md bg-paper-soft px-4 py-3 flex items-baseline justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span className="font-mono-data text-[11px] uppercase tracking-[0.12em] text-ink-muted">
              In your stack
            </span>
            <span className="font-mono-data text-sm text-ink font-semibold tabular-nums">
              {stackLines.length}
              <span className="text-ink-muted font-normal"> / {MAX_LINES} compounds</span>
            </span>
          </div>
          <span className="font-mono-data text-xs text-ink-muted tabular-nums">
            {totalVials} vial{totalVials === 1 ? "" : "s"} · {formatPrice(subtotalCents)}
          </span>
        </div>

        {/* Re-keyed grid — changing the key on the wrapper unmounts and
            remounts every BrowserRow inside, which re-fires each card's
            RevealOnScroll fade-up. The result reads as "products animate
            in" on every category click. */}
        {filteredProducts.length === 0 ? (
          <div className="border rule rounded-md bg-paper-soft p-8 text-sm text-ink-muted text-center">
            No compounds match {query ? `"${query}"` : "this filter"}.
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="ml-2 underline text-wine hover:text-gold-dark"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <ul
            key={`${selectedCategory ?? "all"}|${query}`}
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4"
            aria-label="Compounds available to add"
          >
            {filteredProducts.map((product, idx) => (
              <RevealOnScroll
                key={product.slug}
                delay={Math.min(idx * 55, 600)}
                className="h-full"
              >
                <BrowserRow
                  product={product}
                  inStackQty={
                    draft.lines.find((l) => {
                      const v = product.variants.find((v) => v.sku === l.sku);
                      return Boolean(v);
                    })?.quantity ?? 0
                  }
                  onAdd={(variant, delta) =>
                    upsertLine(variant.sku, variant.size_mg, delta)
                  }
                />
              </RevealOnScroll>
            ))}
          </ul>
        )}
      </section>

      {/* ============ Right: stack panel ============ */}
      <aside
        aria-label="Your custom stack"
        className="lg:sticky lg:top-24 lg:self-start space-y-5"
      >
        {/* Stack hero */}
        <section className="border-2 border-wine bg-paper p-5 space-y-4">
          <div>
            <div className="label-eyebrow text-gold-dark mb-2 text-[11px]">
              Your custom stack
            </div>
            {editingName ? (
              <div className="flex items-stretch gap-2">
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      setEditingName(false);
                    }
                  }}
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  maxLength={100}
                  className="flex-1 min-w-0 px-2 py-1 border rule bg-paper text-ink font-editorial italic text-2xl focus-visible:outline-none focus-visible:border-gold"
                  style={{ fontFamily: "var(--font-editorial)" }}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                className="text-left w-full font-editorial italic text-2xl text-ink leading-tight hover:text-wine transition-colors"
                style={{ fontFamily: "var(--font-editorial)" }}
                title="Click to rename"
              >
                {draft.name}
              </button>
            )}
          </div>

          {/* Empty state */}
          {stackLines.length === 0 ? (
            <div className="border-t rule pt-4">
              <p className="text-sm text-ink-soft italic leading-relaxed">
                Your bench is empty. Pick the compounds you want stacked
                together.
              </p>
            </div>
          ) : (
            <ul className="border-t rule pt-3 space-y-2">
              {stackLines.map(({ line, product, variant }) => (
                <li
                  key={line.sku}
                  className="flex items-center gap-2 text-sm group"
                >
                  {/* Praetorian-style line thumbnail in the basket — gives
                      every entry a visual anchor instead of text-only rows. */}
                  <div className="shrink-0 w-10 h-10 bg-paper-soft rounded-md overflow-hidden border border-rule">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.vial_image}
                      alt=""
                      loading="lazy"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-ink truncate">{product.name}</div>
                    <div className="font-mono-data text-[10px] text-ink-muted">
                      {variant.size_mg}mg · {variant.sku}
                    </div>
                  </div>
                  <div
                    className="shrink-0 inline-flex items-stretch border rule bg-paper text-[11px]"
                    role="group"
                    aria-label={`Quantity for ${product.name}`}
                  >
                    <button
                      type="button"
                      onClick={() => upsertLine(line.sku, line.size_mg, -1)}
                      className="px-1.5 py-1 text-ink-muted hover:text-ink hover:bg-paper-soft transition-colors"
                      aria-label="Decrease"
                    >
                      <Minus className="w-3 h-3" strokeWidth={2} />
                    </button>
                    {/* User direct ask: "get rid of typing option in
                        quantity". Read-only count display; +/- buttons
                        are the only way to change qty. */}
                    <span
                      className="w-9 text-center bg-transparent text-ink font-mono-data text-[12px] select-none"
                      aria-live="polite"
                      aria-label={`Quantity: ${line.quantity}`}
                    >
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => upsertLine(line.sku, line.size_mg, 1)}
                      disabled={line.quantity >= MAX_QTY}
                      className="px-1.5 py-1 text-ink-muted hover:text-ink hover:bg-paper-soft disabled:opacity-30 transition-colors"
                      aria-label="Increase"
                    >
                      <Plus className="w-3 h-3" strokeWidth={2} />
                    </button>
                  </div>
                  <span className="font-mono-data text-[12px] text-ink shrink-0 w-16 text-right">
                    {formatPrice(
                      Math.round(variant.retail_price * 100) * line.quantity,
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLine(line.sku)}
                    className="shrink-0 text-ink-muted hover:text-[color:var(--color-danger)] transition-colors p-1"
                    aria-label={`Remove ${product.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Unlock pills */}
          {stackLines.length > 0 && (
            <div className="space-y-1.5">
              {stackSaveUnlocked && (
                <div className="text-[11px] text-gold-dark font-display uppercase tracking-[0.1em] flex items-center gap-1.5">
                  <Check className="w-3 h-3" strokeWidth={2.5} />
                  Stack &amp; Save unlocked at checkout
                </div>
              )}
              {freeShippingUnlocked ? (
                <div className="text-[11px] text-gold-dark font-display uppercase tracking-[0.1em] flex items-center gap-1.5">
                  <Check className="w-3 h-3" strokeWidth={2.5} />
                  Free shipping unlocked
                </div>
              ) : (
                <div className="text-[11px] text-ink-muted">
                  Add {formatPrice(freeShipShortCents)} more for free shipping.
                </div>
              )}
            </div>
          )}

          {/* Subtotal */}
          {stackLines.length > 0 && (
            <div className="flex items-baseline justify-between border-t rule pt-3">
              <span className="label-eyebrow text-ink-muted text-[10px]">
                Subtotal
              </span>
              <span className="font-mono-data text-2xl text-ink font-semibold">
                {formatPrice(subtotalCents)}
              </span>
            </div>
          )}

          {/* Errors / info */}
          {error && (
            <div
              role="alert"
              className="text-xs text-[color:var(--color-danger)] border-l-4 border-l-[color:var(--color-danger)] bg-paper-soft px-3 py-2"
            >
              {error}
            </div>
          )}
          {info && (
            <div
              role="status"
              aria-live="polite"
              className="text-xs text-ink border-l-4 border-l-gold bg-gold/10 px-3 py-2"
            >
              {info}
            </div>
          )}

          {/* CTAs */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={onAddToCart}
              disabled={stackLines.length === 0 || pending}
              className="w-full inline-flex items-center justify-center gap-2 bg-gold text-wine font-ui font-semibold uppercase tracking-[0.1em] text-xs px-4 py-3 rounded-pill border border-gold hover:bg-gold-light active:scale-[0.99] shadow-[0_6px_14px_rgba(184,146,84,0.30)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} />
              Add to cart
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={pending || (isAuthed && stackLines.length === 0)}
              className="w-full inline-flex items-center justify-center gap-2 bg-paper text-ink font-display uppercase tracking-[0.1em] text-xs px-4 py-3 border rule hover:bg-paper-soft transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-3.5 h-3.5" strokeWidth={2} />
              {isAuthed ? "Save this stack" : "Sign in to save"}
            </button>
            {stackLines.length > 0 && (
              <button
                type="button"
                onClick={clearStack}
                className="w-full text-xs text-ink-muted hover:text-ink underline underline-offset-2"
              >
                Clear stack
              </button>
            )}
          </div>
        </section>

        {/* Saved stacks rail */}
        {isAuthed && (
          <section
            aria-label="Your saved stacks"
            className="border rule bg-paper-soft p-4"
          >
            <div className="label-eyebrow text-ink-muted text-[10px] mb-2">
              Saved stacks ({savedStacks.length})
            </div>
            {savedStacks.length === 0 ? (
              <p className="text-xs text-ink-muted leading-snug">
                Save a stack to reorder it next month with one click.
              </p>
            ) : (
              <ul className="space-y-2">
                {savedStacks.map((s) => {
                  const lineCount = Array.isArray(s.lines)
                    ? s.lines.length
                    : 0;
                  const totalQty = Array.isArray(s.lines)
                    ? s.lines.reduce(
                        (sum, l) =>
                          sum + (typeof l.quantity === "number" ? l.quantity : 0),
                        0,
                      )
                    : 0;
                  return (
                    <li
                      key={s.id}
                      className="border rule bg-paper p-3 space-y-1.5"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-display text-sm text-ink truncate">
                          {s.name}
                        </span>
                        <span className="font-mono-data text-[10px] text-ink-muted shrink-0">
                          {totalQty} vials · {lineCount} SKUs
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => onLoadSaved(s)}
                          disabled={pending}
                          className={cn(
                            "flex-1 text-[11px] h-8 border transition-colors disabled:opacity-50",
                            confirmReplaceLoad === s.id
                              ? "bg-wine text-paper border-wine hover:bg-wine/90"
                              : "bg-paper text-ink border-rule hover:bg-paper-soft",
                          )}
                        >
                          {confirmReplaceLoad === s.id
                            ? "Replace current?"
                            : "Load"}
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSaved(s)}
                          disabled={pending}
                          className={cn(
                            "text-[11px] h-8 px-3 border transition-colors disabled:opacity-50",
                            confirmDelete === s.id
                              ? "bg-[color:var(--color-danger)] text-paper border-[color:var(--color-danger)]"
                              : "bg-paper text-ink-muted border-rule hover:text-[color:var(--color-danger)]",
                          )}
                          aria-label={`Delete ${s.name}`}
                        >
                          {confirmDelete === s.id ? "Confirm" : "Delete"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {!isAuthed && (
          <p className="text-xs text-ink-muted leading-relaxed">
            <Link
              href="/login?next=/catalogue/stacks/build"
              className="underline hover:text-ink"
            >
              Sign in
            </Link>{" "}
            to save this stack and reorder it with one click next month.
          </p>
        )}
      </aside>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Browser row — one product, with size + qty selectors and an Add button.
// ----------------------------------------------------------------------------

function BrowserRow({
  product,
  inStackQty,
  onAdd,
}: {
  product: CatalogProduct;
  inStackQty: number;
  onAdd: (variant: CatalogVariant, delta: number) => void;
}) {
  const [variantSku, setVariantSku] = useState(
    () => product.variants[0]?.sku ?? "",
  );
  const variant = product.variants.find((v) => v.sku === variantSku);
  if (!variant) return null;
  const inThisVariant = inStackQty;
  const inStack = inThisVariant > 0;

  return (
    <li
      className={cn(
        "relative bg-paper rounded-md border-2 transition-all duration-200 flex flex-col p-3 h-full",
        inStack
          ? "border-wine bg-wine/[0.04] shadow-[0_8px_22px_-12px_rgba(74,14,26,0.40)]"
          : "border-rule hover:border-gold-dark hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-14px_rgba(74,14,26,0.25)]",
      )}
    >
      {/* Praetorian-style filled checkmark dot in the corner when the
          card is in the stack — a calmer signal than the v1 gold
          ribbon. Sized large enough to read at a glance. */}
      {inStack && (
        <span
          className="absolute -top-2 -right-2 z-10 inline-flex items-center justify-center w-7 h-7 rounded-full bg-wine text-paper border-2 border-paper shadow-sm"
          aria-label={`${inThisVariant} in your stack`}
        >
          <Check className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />
        </span>
      )}

      {/* Vial photograph */}
      <div className="relative aspect-square bg-paper-soft rounded-md mb-2 overflow-hidden">
        <Image
          src={product.vial_image}
          alt={`${product.name} vial`}
          fill
          sizes="(min-width: 1280px) 200px, (min-width: 640px) 220px, 45vw"
          className="object-cover scale-[1.05] [object-position:60%_50%] transition-transform duration-500 ease-out group-hover:scale-[1.10]"
        />
      </div>

      {/* Compound name */}
      <h3 className="font-display text-[13px] text-ink leading-tight line-clamp-2 min-h-[2.4em] mb-1">
        {product.name}
      </h3>

      {/* Size selector + Add button. Stacks vertically inside the
          narrow card so the size dropdown and Add CTA each get a full
          row. Pill-rounded controls match the v2 surface language. */}
      <div className="mt-auto pt-2 border-t border-rule/60 flex flex-col gap-1.5">
        {product.variants.length > 1 ? (
          <select
            value={variantSku}
            onChange={(e) => setVariantSku(e.target.value)}
            className="w-full px-2.5 py-1.5 text-[11px] font-mono-data bg-paper border rule rounded-input text-ink hover:border-gold-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/30"
            aria-label={`Vial size for ${product.name}`}
          >
            {product.variants.map((v) => (
              <option key={v.sku} value={v.sku}>
                {v.size_mg}mg · {formatPrice(v.retail_price * 100)}
              </option>
            ))}
          </select>
        ) : (
          <span className="block w-full px-2.5 py-1.5 text-[11px] font-mono-data bg-paper-soft border rule rounded-input text-ink-muted text-center">
            {variant.size_mg}mg · {formatPrice(variant.retail_price * 100)}
          </span>
        )}
        <button
          type="button"
          onClick={() => onAdd(variant, 1)}
          className={cn(
            "w-full inline-flex items-center justify-center gap-1 px-2 py-2 rounded-pill text-[11px] font-ui font-bold uppercase tracking-[0.10em] transition-all duration-200 active:scale-[0.98]",
            inStack
              ? "bg-paper text-wine border border-wine hover:bg-wine/10"
              : "bg-gold text-wine border border-gold hover:bg-gold-light shadow-[0_4px_10px_rgba(184,146,84,0.25)]",
          )}
          aria-label={`Add ${product.name} ${variant.size_mg}mg to stack`}
        >
          <Plus className="w-3 h-3" strokeWidth={2.5} aria-hidden />
          {inStack ? "Add another" : "Add to stack"}
        </button>
      </div>
    </li>
  );
}
