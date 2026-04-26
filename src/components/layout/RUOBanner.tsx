import { RUO_STATEMENTS } from "@/lib/compliance";

/**
 * Site-wide RUO banner — wine surface (spec §16.1).
 *
 * Rendered in the root layout above all content. Never dismissible.
 * `data-surface="wine"` lets globals.css handle bg/text inversion. The
 * statement text is set in Cinzel, tracked uppercase, 11px — static (no
 * marquee) per the locked microinteraction principle.
 *
 * Framework ref: RUO compliance framework §3 (required site-wide element).
 */
export function RUOBanner() {
  return (
    <div
      data-surface="wine"
      role="note"
      aria-label="Research use only statement"
      className="font-display text-center py-3 sm:py-3.5 px-4 text-[13px] sm:text-[15px] font-semibold tracking-[0.16em] uppercase"
    >
      {RUO_STATEMENTS.banner}
    </div>
  );
}
