import * as Sentry from "@sentry/nextjs";

/**
 * Next.js instrumentation hook — runs once when the server boots.
 * Initializes Sentry on every runtime where the app executes server
 * code (Node and Edge). No-op when SENTRY_DSN is unset, so dev still
 * boots cleanly without any Sentry credentials.
 */
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      // 10% trace sampling — enough to catch perf regressions without
      // overwhelming the quota. Errors are 100% always.
      tracesSampleRate: 0.1,
      // Don't ship PII — we already pass customer data through trusted
      // server actions; Sentry doesn't need to see it.
      sendDefaultPii: false,
      // Defaults include http + node auto-instrumentation, which is
      // what makes the Sentry Performance tab populate. Don't pass
      // an empty integrations array here — it disables them.
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
  }
}

// Required by @sentry/nextjs ≥ 8 — captures server-component / server-
// action errors automatically and forwards them to Sentry. Without
// this, throws inside RSCs are logged but not reported.
export const onRequestError = Sentry.captureRequestError;
