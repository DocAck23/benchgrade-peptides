import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      { pathname: "/**", search: "" },
      { pathname: "/brand/vials/**", search: "?v=3" },
    ],
  },
  async redirects() {
    // GLP-1 SKUs were renamed from INN-style slugs (semaglutide, etc.) to
    // coded slugs (glp1-s, etc.) for compliance. Any legacy links (shared
    // previews, earlier-pasted URLs) should land on the new page rather
    // than a 404.
    const glp1Legacy: Array<[string, string]> = [
      ["semaglutide", "glp1-s"],
      ["tirzepatide", "glp1-t"],
      ["retatrutide", "glp1-r"],
      ["cagrilintide", "glp1-c"],
      ["mazdutide", "glp1-m"],
      ["survodutide", "glp1-surv"],
    ];
    return glp1Legacy.map(([from, to]) => ({
      source: `/catalog/glp-1/${from}`,
      destination: `/catalog/glp-1/${to}`,
      permanent: true,
    }));
  },
};

export default nextConfig;
