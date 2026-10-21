import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every app screen is per-tenant and rendered on the client, so nothing is cached.
  cacheComponents: false,
  partialPrefetching: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
