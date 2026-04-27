"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { CartButton } from "@/components/cart/CartButton";
import { cn } from "@/lib/utils";

const PRIMARY_NAV = [
  { href: "/catalogue", label: "Catalogue" },
  { href: "/research", label: "Research" },
  { href: "/news", label: "News" },
  { href: "/compliance", label: "Compliance" },
  { href: "/shipping", label: "Shipping" },
  { href: "/about", label: "About" },
] as const;

/**
 * Site header — locked brand visual system (spec §16.1).
 *
 * Surface: cream (page default — no `data-surface` set, inherits body bg/ink).
 * Logo: gold-on-cream mark via `<Logo variant="mark" surface="cream" priority />`.
 * Nav: Cinzel (display), 13px, uppercase, tracked 0.12em. Hover reveals a
 * gold-light underline at 200ms ease.
 * Cart hover: gold-light accent (handled inside `<CartButton>` plus a wrapper
 * group hint for surface-aware fallbacks).
 *
 * Microinteractions: 200ms ease-out — no springs.
 *
 * `accountSlot` is rendered server-side by the root layout (auth-aware
 * Sign-in / account badge) and passed in as a child node so this client
 * component never has to read the session itself. Right-side cluster
 * order: nav | account | cart | mobile-menu-toggle.
 */
export function Header({ accountSlot }: { accountSlot?: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Cinzel UI nav class — shared across desktop + mobile lists so the
  // typographic system is consistent. 13px, uppercase, tracked.
  const navLinkBase =
    "font-display uppercase text-[15px] md:text-[16px] tracking-[0.1em] text-paper-soft transition-colors duration-200 ease-out";
  const navLinkUnderline =
    "relative after:absolute after:left-0 after:right-0 after:-bottom-1 after:h-px after:bg-gold after:scale-x-0 after:origin-left after:transition-transform after:duration-200 after:ease-out hover:text-paper hover:after:scale-x-100";

  return (
    <header data-surface="wine" className="sticky top-0 z-30 border-b border-rule-wine bg-wine text-paper shadow-[0_2px_4px_rgba(74,14,26,0.15)]">
      {/*
        3-column CSS grid:
          [auto]  logo hugs the true left edge
          [1fr]   nav centers in the remaining space, independent of logo width
          [auto]  Account + Cart hug the true right edge
      */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 md:gap-8 pl-3 pr-3 lg:pl-5 lg:pr-5 py-2 md:py-2.5">
        <Logo variant="mark" surface="wine" size="xl" priority />

        <nav
          className="hidden md:flex items-center justify-center gap-7 lg:gap-9"
          aria-label="Primary"
        >
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(navLinkBase, navLinkUnderline)}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4 justify-self-end">
          {accountSlot}
          <span className="[&_button]:transition-colors [&_button]:duration-200 [&_button]:ease-out [&_button]:text-paper-soft [&_button:hover]:text-gold-light">
            <CartButton />
          </span>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden p-2 -mr-1 text-paper-soft hover:text-gold-light active:text-gold transition-colors duration-200 ease-out"
          >
            {mobileOpen ? <X className="w-6 h-6" strokeWidth={1.75} /> : <Menu className="w-6 h-6" strokeWidth={1.75} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer — `inert` removes it from tab order + assistive tech when closed */}
      <nav
        id="mobile-nav"
        aria-label="Primary"
        inert={!mobileOpen}
        className={cn(
          "md:hidden absolute left-0 right-0 top-full z-40 overflow-hidden border-t border-rule-wine bg-paper shadow-lg transition-[max-height,opacity] duration-[250ms] ease-out",
          mobileOpen ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
        )}
      >
        <ul className="px-6 py-4 flex flex-col">
          {PRIMARY_NAV.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="block py-3 font-display uppercase text-[13px] tracking-[0.12em] text-ink hover:text-gold-dark border-b rule last:border-b-0 transition-colors duration-200 ease-out"
              >
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <Link
              href="/account"
              onClick={() => setMobileOpen(false)}
              className="block py-3 font-display uppercase text-[13px] tracking-[0.12em] text-ink hover:text-gold-dark transition-colors duration-200 ease-out"
            >
              Account
            </Link>
          </li>
        </ul>
      </nav>
    </header>
  );
}
