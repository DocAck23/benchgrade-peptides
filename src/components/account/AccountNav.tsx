"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Customer portal nav (spec §5 portal route map).
 *
 * Active tabs: Dashboard, Orders, Subscription.
 * Coming-soon tabs: Messages, Referrals, Profile — rendered non-clickable
 * in `text-ink-muted cursor-not-allowed` with a tooltip per spec §16.4
 * ("greyed but visible — every empty surface is a sales surface").
 */

interface Tab {
  href: string;
  label: string;
  enabled: boolean;
  match?: (pathname: string) => boolean;
}

const TABS: Tab[] = [
  {
    href: "/account",
    label: "Dashboard",
    enabled: true,
    match: (p) => p === "/account",
  },
  {
    href: "/account/orders",
    label: "Orders",
    enabled: true,
    match: (p) => p === "/account/orders" || p.startsWith("/account/orders/"),
  },
  {
    href: "/account/subscription",
    label: "Subscription",
    enabled: true,
    match: (p) =>
      p === "/account/subscription" || p.startsWith("/account/subscription/"),
  },
  { href: "#", label: "Messages", enabled: false },
  { href: "#", label: "Referrals", enabled: false },
  { href: "#", label: "Profile", enabled: false },
];

const baseLink =
  "font-display uppercase text-[13px] tracking-[0.12em] py-3 transition-colors duration-200 ease-out";

export function AccountNav() {
  const pathname = usePathname() ?? "";
  return (
    <nav aria-label="Account" className="border-b rule">
      <ul className="flex flex-wrap items-end gap-x-8 gap-y-2">
        {TABS.map((tab) => {
          if (!tab.enabled) {
            return (
              <li key={tab.label}>
                <span
                  title="Coming soon"
                  aria-disabled="true"
                  className={cn(baseLink, "text-ink-muted cursor-not-allowed")}
                >
                  {tab.label}
                </span>
              </li>
            );
          }
          const active = tab.match ? tab.match(pathname) : pathname === tab.href;
          return (
            <li key={tab.label}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  baseLink,
                  "block",
                  active
                    ? "text-ink border-b-2 border-gold -mb-px"
                    : "text-ink-soft hover:text-ink"
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
