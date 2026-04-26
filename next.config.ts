import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      { pathname: "/**", search: "" },
      { pathname: "/brand/**", search: "" },
      { pathname: "/brand/vials/**", search: "?v=3" },
      { pathname: "/brand/vials/**", search: "?v=4" },
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

export default nextConfig;
