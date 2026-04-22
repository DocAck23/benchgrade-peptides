import { RUO_STATEMENTS } from "@/lib/compliance";

/**
 * Site-wide RUO banner.
 *
 * Rendered in the root layout above all content. Never dismissible.
 * Uses oxblood background to visually reinforce urgency/seriousness.
 *
 * Framework ref: RUO compliance framework §3 (required site-wide element)
 */
export function RUOBanner() {
  return (
    <div
      role="note"
      aria-label="Research use only statement"
      className="bg-[color:var(--color-oxblood)] text-white text-center py-2 px-4 text-[11px] tracking-[0.14em] uppercase font-medium"
    >
      {RUO_STATEMENTS.banner}
    </div>
  );
}
