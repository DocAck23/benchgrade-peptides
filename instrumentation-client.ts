import * as Sentry from "@sentry/nextjs";

/**
 * Browser-side Sentry init. Loaded automatically by the Next.js
 * runtime; mirrors the server config but with browser-appropriate
 * sampling. No-op when DSN is unset.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    // Trace 5% of browser navigations / interactions. Errors are 100%.
    tracesSampleRate: 0.05,
    // No session replay until we know what we want to record. Can
    // toggle on later via @sentry/nextjs/replay.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    sendDefaultPii: false,
    // Browser performance tracing — emits pageload + navigation
    // transactions so the Sentry "Performance" tab actually has data.
    // Default tracePropagationTargets are fine; we don't call cross-
    // origin APIs in the browser path.
    integrations: [Sentry.browserTracingIntegration()],
  });
}

// Capture client-side navigation events so RSC/router transitions
// show up as discrete transactions in Sentry.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
