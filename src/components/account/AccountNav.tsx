"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Customer portal nav (spec §5 portal route map).
 *
 * Active tabs: Dashboard, Orders, Subscription, Messages, Referrals.
 * Coming-soon tab: Profile — rendered non-clickable in
 * `text-ink-muted cursor-not-allowed` with a tooltip per spec §16.4
 * ("greyed but visible — every empty surface is a sales surface").
 *
 * Conditional tab: Affiliate — only rendered when the viewer is an active
 * affiliate (Sprint 4 Wave C). Hidden entirely otherwise — affiliate is
 * opt-in, so we don't tease a "Coming soon" placeholder.
 */

interface Tab {
  href: string;
  label: string;
  enabled: boolean;
  match?: (pathname: string) => boolean;
}

interface AccountNavProps {
  isAffiliate?: boolean;
}

const BASE_TABS: Tab[] = [
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
  {
    href: "/account/messages",
    label: "Messages",
    enabled: true,
    match: (p) =>
      p === "/account/messages" || p.startsWith("/account/messages/"),
  },
  {
    href: "/account/referrals",
    label: "Referrals",
    enabled: true,
    match: (p) =>
      p === "/account/referrals" || p.startsWith("/account/referrals/"),
  },
  {
    href: "/account/security",
    label: "Security",
    enabled: true,
    match: (p) =>
      p === "/account/security" || p.startsWith("/account/security/"),
  },
  { href: "#", label: "Profile", enabled: false },
];

const AFFILIATE_TAB: Tab = {
  href: "/account/affiliate",
  label: "Affiliate",
  enabled: true,
  match: (p) =>
    p === "/account/affiliate" || p.startsWith("/account/affiliate/"),
};

const baseLink =
  "font-display uppercase text-[13px] tracking-[0.12em] py-3 transition-colors duration-200 ease-out";

export function AccountNav({ isAffiliate = false }: AccountNavProps = {}) {
  const pathname = usePathname() ?? "";
  // Inject Affiliate tab BEFORE Profile so the disabled "coming soon" tab
  // stays last in the row.
  const tabs: Tab[] = isAffiliate
    ? [
        ...BASE_TABS.filter((t) => t.enabled),
        AFFILIATE_TAB,
        ...BASE_TABS.filter((t) => !t.enabled),
      ]
    : BASE_TABS;
  return (
    <nav aria-label="Account" className="border-b rule">
      <ul className="flex flex-wrap items-end gap-x-8 gap-y-2">
        {tabs.map((tab) => {
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
