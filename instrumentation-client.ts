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
    // Don't capture browser console errors automatically — too much
    // third-party noise (extensions, ad-blockers). Real app errors
    // throw and get captured via the error boundary path.
    integrations: [],
  });
}
