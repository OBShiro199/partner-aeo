import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every app screen is per-tenant and rendered on the client, so nothing is cached.
  cacheComponents: false,
  partialPrefetching: false,
  images: { remotePatterns: [{ protocol: "https", hostname: "**" }] },
  poweredByHeader: false,
  async headers() {
    const base = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    ];
    return [
      // The app can't be framed (clickjacking); the scanner embed is meant to be.
      { source: "/((?!embed/).*)", headers: [...base, { key: "X-Frame-Options", value: "DENY" }, { key: "Content-Security-Policy", value: "frame-ancestors 'none'" }] },
      { source: "/embed/:key*", headers: [...base, { key: "Content-Security-Policy", value: "frame-ancestors *" }] },
      // Agencies load this on every page view of their site: cache it at the edge, refresh hourly.
      { source: "/widget.js", headers: [{ key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" }, { key: "Access-Control-Allow-Origin", value: "*" }] },
    ];
  },
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
