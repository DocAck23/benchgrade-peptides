"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { CartButton } from "@/components/cart/CartButton";
import { useOverlay } from "@/components/ui/Overlay";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/routes";

/**
 * Sub-project A · Foundation, commit 11 of 22.
 *
 * v2 changes from v1:
 *   - Logo at size="nav" (180 px) via the v2 lockup PNG
 *   - Mobile drawer pattern locked: SIDE FROM LEFT, full-height,
 *     min(80vw, 320px) wide, dialog semantics, scrim + escape close,
 *     respects prefers-reduced-motion (Codex Review #1 fix H2)
 *   - Drawer uses the shared useOverlay primitive (Codex H1)
 *   - Tap-target floor enforced at 44×44 px on hamburger, account, cart
 *     (Codex M4 — prior code had hamburger ~40 px, avatar 32 px)
 *   - Nav routes pulled from src/lib/routes.ts (Foundation contract Rule 2)
 *   - /news removed from nav (per memory/catalog_changes_v2.md)
 */

const PRIMARY_NAV = [
  { href: ROUTES.CATALOG, label: "Catalog" },
  { href: ROUTES.RESEARCH, label: "Research" },
  { href: ROUTES.COMPLIANCE, label: "Compliance" },
  { href: ROUTES.SHIPPING, label: "Shipping" },
  { href: ROUTES.ABOUT, label: "About" },
] as const;

export function Header({ accountSlot }: { accountSlot?: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  // Scroll-direction hide. Threshold suppresses jitter near the top.
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (Math.abs(delta) < 8) return;
      if (y < 80) setHidden(false);
      else if (delta > 0) setHidden(true);
      else setHidden(false);
      lastY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Mobile drawer: focus trap + ref-counted scroll lock + escape +
  // focus restore inherited from useOverlay.
  const closeDrawer = () => setMobileOpen(false);
  const { containerRef: drawerRef } = useOverlay<HTMLDivElement>(mobileOpen, {
    closeOnEscape: true,
    onClose: closeDrawer,
    restoreFocus: true,
    lockScroll: true,
    trapFocus: true,
  });

  // Codex adversarial review #2 fix P1: when the viewport widens past
  // the md breakpoint (≥768 px), the drawer + scrim are visually hidden
  // by md:hidden but mobileOpen doesn't change — useOverlay then keeps
  // body scroll locked + focus trapped while the hamburger and close
  // controls are no longer visible, leaving the user stuck. Listen for
  // the breakpoint crossing and force the drawer closed.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileOpen(false);
    };
    // Defensive: if we mount with md+ already true, ensure we don't
    // start with the drawer in a stuck-open state.
    if (mq.matches) setMobileOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const tapTarget =
    "min-w-[44px] min-h-[44px] inline-flex items-center justify-center";

  const navLinkBase =
    "font-ui uppercase text-[14px] md:text-[15px] tracking-[0.10em] text-paper-soft transition-colors duration-200 ease-out";
  const navLinkUnderline =
    "relative after:absolute after:left-0 after:right-0 after:-bottom-1 after:h-px after:bg-gold after:scale-x-0 after:origin-left after:transition-transform after:duration-200 after:ease-out hover:text-paper hover:after:scale-x-100";

  const drawerLinkClass =
    "block min-h-[44px] py-3 px-1 font-ui uppercase text-[14px] tracking-[0.12em] text-ink hover:text-gold-dark border-b rule last:border-b-0 transition-colors duration-200 ease-out";

  return (
    <header
      data-surface="wine"
      className={cn(
        "sticky top-0 z-30 border-b border-rule-wine bg-wine text-paper shadow-[0_2px_4px_rgba(74,14,26,0.15)] transition-transform duration-200 ease-out",
        hidden && "-translate-y-full"
      )}
    >
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-4 md:gap-8 pl-3 pr-3 lg:pl-5 lg:pr-5 py-1 md:py-1.5">
        {/* Logo: bumped to 260 px (was 180) per user direct ask: "make
            the bench grade peptides logo larger inside of the menu bar.
            I would like it to be more fuller inside of the menu bar."
            Mobile cap raised from 140→170 so it grows on small screens
            too without overflowing 320 px viewports. */}
        <span className="block w-[min(170px,42vw)] sm:w-[220px] lg:w-[260px]">
          <Logo size="nav" surface="wine" priority />
        </span>

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

        <div className="flex items-center gap-2 justify-self-end">
          {/* Account avatar wrapper — enforces tap-target floor */}
          <span className={cn(tapTarget, "[&_button]:min-w-[44px] [&_button]:min-h-[44px]")}>
            {accountSlot}
          </span>
          <span
            className={cn(
              tapTarget,
              "[&_button]:min-w-[44px] [&_button]:min-h-[44px]",
              "[&_button]:transition-colors [&_button]:duration-200 [&_button]:ease-out [&_button]:text-paper-soft [&_button:hover]:text-gold-light"
            )}
          >
            <CartButton />
          </span>
          <button
            type="button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav-drawer"
            onClick={() => setMobileOpen((v) => !v)}
            className={cn(
              "md:hidden text-paper-soft hover:text-gold-light active:text-gold transition-colors duration-200 ease-out",
              tapTarget
            )}
          >
            {mobileOpen ? (
              <X className="w-6 h-6" strokeWidth={1.75} />
            ) : (
              <Menu className="w-6 h-6" strokeWidth={1.75} />
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer — SIDE FROM LEFT (locked Foundation drawer pattern). */}
      <div
        aria-hidden="true"
        onClick={closeDrawer}
        className={cn(
          "md:hidden fixed inset-0 z-40 bg-ink/42 transition-opacity duration-200 motion-reduce:transition-none",
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      />
      <div
        ref={drawerRef}
        id="mobile-nav-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Primary navigation"
        inert={!mobileOpen}
        className={cn(
          "md:hidden fixed top-0 left-0 z-50 h-full w-[min(80vw,320px)]",
          "bg-paper text-ink border-r rule shadow-2xl",
          "flex flex-col",
          "transition-transform duration-[240ms] ease-out motion-reduce:transition-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="flex items-center justify-between px-5 pt-3 pb-4 border-b rule">
          <span className="label-eyebrow text-ink-muted">Menu</span>
          <button
            type="button"
            onClick={closeDrawer}
            aria-label="Close menu"
            className={cn(tapTarget, "text-ink-soft hover:text-ink active:text-gold-dark transition-colors")}
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>
        <nav aria-label="Primary" className="flex-1 overflow-y-auto px-5 py-2">
          <ul className="flex flex-col">
            {PRIMARY_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={closeDrawer}
                  className={drawerLinkClass}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={ROUTES.ACCOUNT}
                onClick={closeDrawer}
                className={drawerLinkClass}
              >
                Account
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
