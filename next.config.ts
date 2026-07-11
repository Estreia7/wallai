import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Tree-shake recharts' barrel export so only used chart primitives ship,
    // and avoid duplicating the library across route chunks.
    optimizePackageImports: ["recharts"],
  },
};

export default nextConfig;
