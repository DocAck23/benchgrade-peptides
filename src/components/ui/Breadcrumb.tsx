import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <Fragment key={`${item.label}-${idx}`}>
            {item.href && !isLast ? (
              <Link href={item.href} className="text-ink-muted hover:text-teal transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-ink" : "text-ink-muted"}>{item.label}</span>
            )}
            {!isLast && <ChevronRight className="w-3 h-3 text-ink-faint" strokeWidth={1.5} />}
          </Fragment>
        );
      })}
    </nav>
  );
}
