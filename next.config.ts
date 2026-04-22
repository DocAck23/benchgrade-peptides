import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    localPatterns: [
      { pathname: "/**", search: "" },
      { pathname: "/brand/vials/**", search: "?v=3" },
    ],
  },
};

export default nextConfig;
