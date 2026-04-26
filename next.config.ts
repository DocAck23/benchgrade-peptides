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
};

export default nextConfig;
