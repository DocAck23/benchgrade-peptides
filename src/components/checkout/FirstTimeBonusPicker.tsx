"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import { cn, formatPrice } from "@/lib/utils";

export interface BonusChoice {
  sku: string;
  name: string;
  size_mg: number;
  pack_size: number;
  retail_price_cents: number;
  discounted_cents: number;
  image_url: string;
}

interface Props {
  choices: BonusChoice[];
  selectedSku: string;
  onSelect: (sku: string) => void;
}

/**
 * Card-grid picker for the first-time-buyer 25%-off bonus vial.
 * Replaces the legacy dropdown with a searchable visual grid so
 * researchers can recognize products at a glance instead of scanning
 * a long flat list.
 *
 * Behavior:
 *   • One-of selection (radio semantics) — empty string = skipped
 *   • Filter narrows by product name (case-insensitive substring)
 *   • Selected card gets a wine border + checkmark badge
 */
export function FirstTimeBonusPicker({
  choices,
  selectedSku,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return choices;
    return choices.filter((c) => c.name.toLowerCase().includes(q));
  }, [query, choices]);

  return (
    <div className="mt-3 space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-pressed={selectedSku === ""}
          onClick={() => onSelect("")}
          className={cn(
            "h-9 px-3 text-xs tracking-[0.04em] border rule transition-colors",
            selectedSku === ""
              ? "bg-ink text-paper border-ink"
              : "bg-paper text-ink hover:bg-paper-soft",
          )}
        >
          Skip this offer
        </button>
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search compounds…"
            className="w-full h-9 pl-8 pr-3 text-sm border rule bg-paper text-ink placeholder:text-ink-muted focus:outline-none focus:border-ink"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-ink-muted py-4 text-center">
          No compounds match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <ul
          role="radiogroup"
          aria-label="First-time bonus vial"
          className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[420px] overflow-y-auto pr-1"
        >
          {filtered.map((c) => {
            const selected = selectedSku === c.sku;
            return (
              <li key={c.sku}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onSelect(c.sku)}
                  className={cn(
                    "relative w-full text-left flex flex-col bg-paper border-2 rule transition-colors",
                    selected
                      ? "border-wine"
                      : "border-paper-soft hover:border-ink-muted",
                  )}
                >
                  {selected && (
                    <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-wine text-paper inline-flex items-center justify-center shadow-sm">
                      <Check className="w-3 h-3" strokeWidth={3} />
                    </span>
                  )}
                  <div className="relative aspect-square bg-paper-soft border-b rule overflow-hidden shrink-0">
                    <Image
                      src={c.image_url}
                      alt=""
                      fill
                      sizes="(min-width: 640px) 160px, 50vw"
                      className="object-cover scale-[1.05]"
                    />
                  </div>
                  <div className="p-2 flex flex-col gap-0.5">
                    <div className="font-display text-[12px] text-ink leading-tight line-clamp-2 min-h-[2.4em]">
                      {c.name}
                    </div>
                    <div className="label-eyebrow text-ink-muted text-[9px]">
                      {c.size_mg}mg · {c.pack_size}-vial
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="font-mono-data text-[12px] text-wine font-semibold">
                        {formatPrice(c.discounted_cents)}
                      </span>
                      <span className="font-mono-data text-[10px] text-ink-muted line-through">
                        {formatPrice(c.retail_price_cents)}
                      </span>
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
