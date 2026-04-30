import { RUO_STATEMENTS } from "@/lib/compliance";

/**
 * Site-wide RUO banner — wine surface.
 *
 * Sub-project A · Foundation, commit 13 of 22.
 *
 * v2 changes from v1:
 *   - Type face: font-ui (Montserrat tracked) instead of font-display (Cinzel)
 *   - Padding tightened on mobile so it eats less hero real estate
 *   - Tracking 0.20em (was 0.18em) for the wider Montserrat letterforms
 *
 * Rendered in the root layout above all content. Never dismissible.
 * `data-surface="wine"` lets globals.css handle bg/text inversion.
 *
 * Framework ref: RUO compliance framework §3 (required site-wide element).
 */
export function RUOBanner() {
  return (
    <div
      data-surface="wine"
      role="note"
      aria-label="Research use only statement"
      className="font-ui text-center py-1 sm:py-1.5 px-4 text-[10px] sm:text-[11px] font-semibold tracking-[0.20em] uppercase"
    >
      {RUO_STATEMENTS.banner}
    </div>
  );
}
