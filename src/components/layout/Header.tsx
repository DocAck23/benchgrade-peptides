"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { cn } from "@/lib/utils";

const PRIMARY_NAV = [
  { href: "/catalog", label: "Catalog" },
  { href: "/compliance", label: "Compliance" },
  { href: "/shipping", label: "Shipping" },
  { href: "/about", label: "About" },
] as const;

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="border-b rule bg-paper relative">
      {/*
        3-column CSS grid:
          [auto]  logo hugs the true left edge
          [1fr]   nav centers in the remaining space, independent of logo width
          [auto]  Account + Cart hug the true right edge

        No max-width wrapper — the logo and right nav should touch the
        viewport edges on every breakpoint.
      */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 md:gap-8 pl-3 pr-3 lg:pl-5 lg:pr-5 py-2 md:py-2.5">
        <Logo size="xl" priority />

        <nav
          className="hidden md:flex items-center justify-center gap-10 lg:gap-12"
          aria-label="Primary"
        >
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-base text-ink-soft hover:text-teal transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4 justify-self-end">
          <Link
            href="/account"
            className="hidden md:inline-block text-base text-ink-soft hover:text-teal transition-colors"
          >
            Account
          </Link>
          <Link
            href="/cart"
            className="text-base px-4 py-2 border rule text-ink hover:bg-paper-soft transition-colors"
          >
            Cart
          </Link>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 text-ink-soft hover:text-ink"
          >
            {mobileOpen ? <X className="w-5 h-5" strokeWidth={1.5} /> : <Menu className="w-5 h-5" strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer — `inert` removes it from tab order + assistive tech when closed */}
      <nav
        id="mobile-nav"
        aria-label="Primary"
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-expect-error -- `inert` is valid HTML and supported in React 19
        inert={mobileOpen ? undefined : ""}
        className={cn(
          "md:hidden overflow-hidden border-t rule bg-paper transition-[max-height,opacity] duration-200",
          mobileOpen ? "max-h-[320px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        )}
      >
        <ul className="px-6 py-4 flex flex-col">
          {PRIMARY_NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block py-3 text-base text-ink hover:text-teal border-b rule last:border-b-0"
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/account"
              onClick={() => setMobileOpen(false)}
              className="block py-3 text-base text-ink hover:text-teal"
            >
              Account
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
