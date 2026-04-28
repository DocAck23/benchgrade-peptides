/**
 * Microsoft Clarity wrapper. Thin around `@microsoft/clarity` so call
 * sites don't need to handle the "is Clarity loaded yet?" question
 * everywhere — every helper is a no-op when the package isn't ready
 * (no project ID, init not yet run, SSR context, etc).
 *
 * Why a wrapper at all: we want to call `identify()` and `event()`
 * from across the client codebase without each call site needing to
 * import the SDK directly or reason about its lifecycle.
 */

import Clarity from "@microsoft/clarity";

let initialized = false;

export function clarityInit(projectId: string): void {
  if (initialized) return;
  if (typeof window === "undefined") return;
  if (!projectId) return;
  try {
    Clarity.init(projectId);
    initialized = true;
  } catch {
    /* best-effort */
  }
}

/**
 * Tag every subsequent Clarity replay in this session with the given
 * customer email. Call after the user signs in or submits an order.
 * Safe to call repeatedly — Clarity dedupes server-side.
 */
export function clarityIdentify(email: string | null | undefined): void {
  if (!initialized) return;
  if (!email) return;
  try {
    // Args: customId, customSessionId?, customPageId?, friendlyName?
    Clarity.identify(email.trim().toLowerCase());
  } catch {
    /* best-effort */
  }
}

/**
 * Drop a marker on the Clarity timeline so a session replay viewer
 * can jump to the moment a key thing happened (FIRST250 redeem,
 * order submit, subscription start, …). Use sparingly — too many
 * markers makes the timeline noisy.
 */
export function clarityEvent(name: string): void {
  if (!initialized) return;
  if (!name) return;
  try {
    Clarity.event(name);
  } catch {
    /* best-effort */
  }
}
