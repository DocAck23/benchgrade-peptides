import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      { pathname: "/**", search: "" },
      { pathname: "/brand/vials/**", search: "?v=2" },
    ],
  },
};

export default nextConfig;
