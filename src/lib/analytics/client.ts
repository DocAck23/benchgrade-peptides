/**
 * Client-side analytics dispatch. Standalone helper — does NOT depend
 * on `window.bgpTrack`, so it works even on the very first paint of a
 * page (before the AnalyticsBeacon component's effect has installed
 * the global). Both the global tracker and any individual beacon
 * component (ProductViewBeacon, etc.) call into this.
 *
 * Uses `navigator.sendBeacon` when available so the request survives
 * page unload; falls back to a fetch with `keepalive: true`.
 */

import type { AnalyticsEventName } from "./types";

interface SendOptions {
  path?: string;
  properties?: Record<string, unknown>;
  init?: Record<string, unknown>;
}

export function sendAnalyticsEvent(
  name: AnalyticsEventName,
  options: SendOptions = {},
): void {
  if (typeof window === "undefined") return;
  try {
    const path =
      options.path ??
      window.location.pathname +
        (window.location.search ? window.location.search : "");
    const body = JSON.stringify({
      name,
      path,
      properties: options.properties ?? {},
      init: options.init,
    });
    const url = "/api/analytics";
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function"
    ) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    });
  } catch {
    /* analytics is best-effort — must never throw into render */
  }
}
