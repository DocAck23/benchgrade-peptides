import Link from "next/link";
import { Fragment } from "react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

/**
 * Sub-project A · Foundation, commit 14 of 22.
 *
 * v2: Montserrat tracked (font-ui), separator glyph "›" (was "/" in v1
 * for editorial feel; v2 uses a typographic guillemet for the cleaner
 * Praetorian / MyTide pattern).
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 text-xs font-ui tracking-[0.04em]"
    >
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <Fragment key={`${item.label}-${idx}`}>
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-ink-muted hover:text-gold-dark transition-colors duration-200 ease-[var(--ease-default)]"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-ink" : "text-ink-muted"}>{item.label}</span>
            )}
            {!isLast && (
              <span aria-hidden="true" className="text-gold-dark select-none">
                ›
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
