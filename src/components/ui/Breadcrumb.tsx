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
 * Locked breadcrumb (spec §16.1):
 *   - Inter sans, ink-muted text, ink on the current page
 *   - gold-dark separator characters (uses a literal "/" glyph rather than
 *     a chevron icon — heritage / editorial feel)
 */
export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-2 text-xs font-sans"
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
                /
              </span>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
