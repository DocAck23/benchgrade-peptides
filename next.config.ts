import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      // Query-less local paths (icons, brand marks, etc.)
      { pathname: "/**", search: "" },
      { pathname: "/brand/**", search: "" },
      // Vial product photos use a per-build cache-buster query.
      // Bump these in lockstep with VIAL_PHOTO_VERSION in src/lib/catalogue/data.ts
      // when refreshing the photoset; older versions can stay listed so deep
      // links from old emails / cached pages still resolve.
      { pathname: "/brand/vials/**", search: "?v=3" },
      { pathname: "/brand/vials/**", search: "?v=4" },
      { pathname: "/brand/vials/**", search: "?v=56" },
    ],
  },
  // Catalog rebuilt 2026-04-25 with the full AgeREcode SKU list under
  // actual compound names (Semaglutide / Tirzepatide / Retatrutide etc.)
  // — superseding the earlier coded-slug experiment. Legacy redirects
  // removed because the coded slugs were never published externally.

  // 2026-04-26 spelling pivot: /catalog → /catalogue. Permanent 301s
  // preserve any inbound bookmarks / external links from the brief
  // window the /catalog routes were public. Wildcards cover the whole
  // sub-tree (categories, product detail, /catalog/stacks/[slug]).
  async redirects() {
    return [
      { source: "/catalog", destination: "/catalogue", permanent: true },
      { source: "/catalog/:path*", destination: "/catalogue/:path*", permanent: true },
    ];
  },
};

// Sentry wrapper — uploads source maps + injects the SDK into the
// build. `SENTRY_AUTH_TOKEN` is required for source-map upload (set
// on Vercel only); locally the wrapper no-ops the upload step.
// Tunnel + tracing/replay opts kept conservative; we can ratchet
// sampling up after we see baseline error volume.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  // Hide source maps from public access (still uploaded to Sentry).
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  // Disable Sentry tunneling (would route browser SDK calls through
  // /monitoring); ad-blockers don't bother us yet and the route adds
  // edge function invocations.
  tunnelRoute: undefined,
  // Don't fail the Vercel build on Sentry upload errors — error
  // visibility is a "nice to have" and we don't want it to gate
  // production releases.
  errorHandler: () => {},
  disableLogger: true,
});
