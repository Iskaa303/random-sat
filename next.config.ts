import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable optimized package imports to reduce bundle size
  experimental: {
    optimizePackageImports: [
      "@radix-ui/primitive",
      "clsx",
      "tailwind-merge",
    ],
  },
};

export default nextConfig;
