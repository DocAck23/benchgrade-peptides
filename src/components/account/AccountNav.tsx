"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/actions/session";

/**
 * Customer portal nav (spec §5 portal route map).
 *
 * Layout: sticky left rail on lg+ (so the customer can browse without
 * leaving the portal context), horizontal scroll strip on mobile.
 * Attention badge: a small pill `(N)` beside an item when the
 * corresponding count > 0 — drives the user to act on payment-pending
 * orders or unread messages without forcing them to the dashboard.
 *
 * Active tabs: Dashboard, Orders, Subscription, Messages, Referrals,
 * Security. Coming-soon tab: Profile — rendered non-clickable in
 * `text-ink-muted cursor-not-allowed` with a tooltip per spec §16.4
 * ("greyed but visible — every empty surface is a sales surface").
 *
 * Conditional tab: Affiliate — only rendered when the viewer is an active
 * affiliate. Hidden entirely otherwise — affiliate is opt-in, so we
 * don't tease a placeholder.
 */

type AttentionKey = "orders" | "messages";

interface Tab {
  href: string;
  label: string;
  enabled: boolean;
  match?: (pathname: string) => boolean;
  attention?: AttentionKey;
}

interface AccountNavProps {
  isAffiliate?: boolean;
  /**
   * Counts of items requiring user action. Each maps to an `attention`
   * key on the corresponding tab. Zero or undefined → no badge.
   */
  attention?: Partial<Record<AttentionKey, number>>;
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
    attention: "orders",
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
    attention: "messages",
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
  {
    href: "/account/profile",
    label: "Profile",
    enabled: true,
    match: (p) =>
      p === "/account/profile" || p.startsWith("/account/profile/"),
  },
];

const AFFILIATE_TAB: Tab = {
  href: "/account/affiliate",
  label: "Affiliate",
  enabled: true,
  match: (p) =>
    p === "/account/affiliate" || p.startsWith("/account/affiliate/"),
};

const linkBase =
  "font-display uppercase text-[12px] tracking-[0.12em] transition-colors duration-200 ease-out";

function Badge({ count }: { count: number }) {
  // Cap at 99+ to keep layout stable; sub-2-digit pad keeps the rail
  // a consistent width when the badge appears mid-session. Wine pill
  // with bold paper text — gold-on-cream tested poorly (low contrast,
  // missed at a glance).
  const display = count > 99 ? "99+" : String(count);
  return (
    <span
      aria-label={`${count} need${count === 1 ? "s" : ""} attention`}
      className="ml-2 inline-flex items-center justify-center min-w-[1.4rem] h-5 px-1.5 rounded-full bg-wine text-paper text-[11px] font-display font-bold tracking-[0.02em] leading-none"
    >
      {display}
    </span>
  );
}

export function AccountNav({
  isAffiliate = false,
  attention,
}: AccountNavProps = {}) {
  const pathname = usePathname() ?? "";
  const tabs: Tab[] = isAffiliate
    ? [
        ...BASE_TABS.filter((t) => t.enabled),
        AFFILIATE_TAB,
        ...BASE_TABS.filter((t) => !t.enabled),
      ]
    : BASE_TABS;

  const renderTab = (tab: Tab, orientation: "rail" | "strip") => {
    const isRail = orientation === "rail";
    const count =
      tab.attention && attention ? attention[tab.attention] ?? 0 : 0;

    if (!tab.enabled) {
      return (
        <li key={tab.label}>
          <span
            title="Coming soon"
            aria-disabled="true"
            className={cn(
              linkBase,
              "text-ink-muted cursor-not-allowed",
              isRail ? "block py-2" : "block py-3 whitespace-nowrap",
            )}
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
            linkBase,
            "flex items-center",
            isRail
              ? cn(
                  "py-2 border-l-2 -ml-px pl-4",
                  active
                    ? "text-ink border-gold"
                    : "text-ink-soft border-transparent hover:text-ink hover:border-ink-muted",
                )
              : cn(
                  "py-3 whitespace-nowrap",
                  active
                    ? "text-ink border-b-2 border-gold -mb-px"
                    : "text-ink-soft hover:text-ink",
                ),
          )}
        >
          <span>{tab.label}</span>
          {count > 0 && <Badge count={count} />}
        </Link>
      </li>
    );
  };

  return (
    <>
      {/* Mobile: horizontal scroll strip — keeps current behavior on small
          screens where a sidebar would eat real estate. Sign-out lives
          in the global header dropdown on mobile (and is appended to
          the strip below as a last resort if the dropdown ever fails
          to mount). */}
      <nav
        aria-label="Account"
        className="lg:hidden border-b rule overflow-x-auto"
      >
        <ul className="flex items-end gap-x-6 min-w-max">
          {tabs.map((t) => renderTab(t, "strip"))}
          <li>
            <form action={signOutAction}>
              <button
                type="submit"
                className={cn(
                  linkBase,
                  "block py-3 whitespace-nowrap text-ink-soft hover:text-ink",
                )}
              >
                Sign out
              </button>
            </form>
          </li>
        </ul>
      </nav>
      {/* Desktop: sticky left rail. Sticks to top of viewport so the
          customer can scroll long detail pages and still navigate.
          Sign-out is anchored to the bottom of the rail (via mt-auto
          on a flex-col wrapper) so it's always one click away. */}
      <nav
        aria-label="Account"
        className="hidden lg:flex lg:flex-col lg:sticky lg:top-24 lg:self-start"
      >
        <ul className="flex flex-col border-l rule">
          {tabs.map((t) => renderTab(t, "rail"))}
        </ul>
        <form action={signOutAction} className="mt-6 ml-[-1px] pl-4 border-l rule">
          <button
            type="submit"
            className={cn(
              linkBase,
              "py-2 text-ink-soft hover:text-ink",
            )}
          >
            Sign out
          </button>
        </form>
      </nav>
    </>
  );
}
