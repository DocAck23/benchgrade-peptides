"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutAction } from "@/app/actions/session";
import { cn } from "@/lib/utils";

/**
 * Global header avatar → dropdown menu. Mirrors the /account sidebar
 * so a signed-in customer can hop into any portal surface from any
 * page (catalogue, research, etc.) without losing context. Same
 * attention badges as the sidebar — orders awaiting payment and
 * unread admin replies pull the customer back to the right surface.
 *
 * Self-contained close behavior:
 *  - Click outside the menu container
 *  - Press Escape
 *  - Navigate (route change) — closes via the pathname-effect dep
 *
 * Sign-out is dispatched via a server action so the auth cookie is
 * cleared on the response and the redirect to `/` happens server-side.
 */

interface DropdownItem {
  href: string;
  label: string;
  badgeCount?: number;
}

interface AccountMenuDropdownProps {
  email: string;
  initial: string;
  isAffiliate: boolean;
  attention: { orders: number; messages: number };
}

export function AccountMenuDropdown({
  email,
  initial,
  isAffiliate,
  attention,
}: AccountMenuDropdownProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();

  // Close on outside click + Escape. Mounted only while open so we
  // don't sap CPU listening for events on every page.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Auto-close on route change so the menu doesn't linger after click.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const items: DropdownItem[] = [
    { href: "/account", label: "Dashboard" },
    { href: "/account/orders", label: "Orders", badgeCount: attention.orders },
    { href: "/account/subscription", label: "Subscription" },
    { href: "/account/messages", label: "Messages", badgeCount: attention.messages },
    { href: "/account/referrals", label: "Referrals" },
    { href: "/account/security", label: "Security" },
    { href: "/account/profile", label: "Profile" },
  ];
  if (isAffiliate) {
    // Slot Affiliate above Profile so the section reads
    // "earn → manage" rather than landing on a profile editor first.
    items.splice(items.length - 1, 0, { href: "/account/affiliate", label: "Affiliate" });
  }

  // Surface a single combined badge on the avatar trigger so the
  // customer sees something needs attention even when the menu is
  // closed.
  const totalAttention = attention.orders + attention.messages;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex items-center justify-center w-8 h-8 rounded-full bg-paper-soft border rule text-gold-dark font-display text-sm hover:bg-paper hover:text-ink transition-colors duration-200 ease-out"
      >
        <span aria-hidden="true">{initial}</span>
        {totalAttention > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-wine text-paper text-[10px] font-display font-bold leading-none border border-paper"
          >
            {totalAttention > 9 ? "9+" : totalAttention}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-full mt-2 w-[min(16rem,calc(100vw-1.5rem))] bg-paper border rule shadow-lg z-50"
        >
          <div className="px-4 py-3 border-b rule">
            <div className="text-[10px] font-display uppercase tracking-[0.18em] text-ink-muted">
              Signed in as
            </div>
            <div className="mt-1 text-sm text-ink truncate" title={email}>
              {email}
            </div>
          </div>
          <ul className="py-2">
            {items.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              const count = item.badgeCount ?? 0;
              return (
                <li key={item.href} role="none">
                  <Link
                    href={item.href}
                    role="menuitem"
                    className={cn(
                      "flex items-center justify-between gap-3 px-4 py-2 text-sm transition-colors duration-150",
                      isActive
                        ? "text-ink bg-paper-soft"
                        : "text-ink-soft hover:text-ink hover:bg-paper-soft",
                    )}
                  >
                    <span>{item.label}</span>
                    {count > 0 && (
                      <span
                        aria-label={`${count} need${count === 1 ? "s" : ""} attention`}
                        className="inline-flex items-center justify-center min-w-[1.4rem] h-5 px-1.5 rounded-full bg-wine text-paper text-[10px] font-display font-bold leading-none"
                      >
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          <form action={signOutAction} className="border-t rule">
            <button
              type="submit"
              role="menuitem"
              className="w-full text-left px-4 py-3 text-sm text-ink-soft hover:text-ink hover:bg-paper-soft transition-colors duration-150 font-display uppercase text-[12px] tracking-[0.12em]"
            >
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
