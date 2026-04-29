"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { sendAnalyticsEvent } from "@/lib/analytics/client";
import type { AnalyticsEventName } from "@/lib/analytics/types";

declare global {
  interface Window {
    bgpTrack?: (
      name: AnalyticsEventName,
      properties?: Record<string, unknown>,
    ) => void;
  }
}

const SESSION_KEY = "bgp_sess_init"; // sessionStorage flag — first hit per tab

/**
 * Mounted once at the root layout. Two responsibilities:
 *
 *   1. Fire a `pageview` on every client-side route change. The first
 *      pageview of a tab also carries the `init` payload (landing_path,
 *      referrer, utm_*) so the server can populate the session row.
 *
 *   2. Expose `window.bgpTrack(name, props)` for ad-hoc event firing
 *      from non-React code paths. New components should prefer
 *      importing `sendAnalyticsEvent` directly so they don't race
 *      with the install of this global on first paint.
 */
export function AnalyticsBeacon() {
  const pathname = usePathname();
  const search = useSearchParams();
  const lastPath = useRef<string | null>(null);

  // Install the global tracker so non-React code (cart context, ad-hoc
  // imperative call sites) can fire events without importing.
  useEffect(() => {
    window.bgpTrack = (name, properties) =>
      sendAnalyticsEvent(name, { properties: properties ?? {} });
    return () => {
      delete window.bgpTrack;
    };
  }, []);

  useEffect(() => {
    if (!pathname) return;
    const fullPath = pathname + (search?.toString() ? `?${search}` : "");
    if (lastPath.current === fullPath) return;
    lastPath.current = fullPath;

    // First pageview of the tab? Send init payload so the server can
    // populate the session row.
    let init: Record<string, unknown> | undefined;
    try {
      const seen = sessionStorage.getItem(SESSION_KEY);
      if (!seen) {
        sessionStorage.setItem(SESSION_KEY, "1");
        const params = search;
        init = {
          landing_path: pathname,
          referrer: document.referrer || null,
          utm_source: params?.get("utm_source") ?? null,
          utm_medium: params?.get("utm_medium") ?? null,
          utm_campaign: params?.get("utm_campaign") ?? null,
          utm_content: params?.get("utm_content") ?? null,
          utm_term: params?.get("utm_term") ?? null,
          // Ad-platform click ids — Google `gclid`, Meta `fbclid`,
          // generic `utm_id` (some platforms emit this instead of UTM).
          // Frozen on first hit alongside the UTM block so subsequent
          // navigations don't overwrite the first-touch attribution.
          gclid: params?.get("gclid") ?? null,
          fbclid: params?.get("fbclid") ?? null,
          utm_id: params?.get("utm_id") ?? null,
        };
      }
    } catch {
      /* private mode / SSR — skip init payload */
    }

    sendAnalyticsEvent("pageview", {
      path: fullPath,
      properties: { title: document.title },
      init,
    });
  }, [pathname, search]);

  return null;
}
