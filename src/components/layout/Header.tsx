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
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10 py-6 flex items-center justify-between gap-8">
        <Logo size="md" />

        <nav className="hidden md:flex items-center gap-10" aria-label="Primary">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm text-ink-soft hover:text-teal transition-colors"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/account"
            className="hidden md:inline-block text-sm text-ink-soft hover:text-teal transition-colors"
          >
            Account
          </Link>
          <Link
            href="/cart"
            className="text-sm px-4 py-2 border rule text-ink hover:bg-paper-soft transition-colors"
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

      {/* Mobile drawer */}
      <nav
        id="mobile-nav"
        aria-label="Primary"
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
