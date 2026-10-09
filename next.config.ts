import type { NextConfig } from "next";

// Cache Components (and the static shell it prerenders) cannot carry a
// per-request CSP nonce, so it is off: every page here is rendered per request
// and gets a strict, nonce-based policy from proxy.ts. See README "Tradeoffs".
const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    // When the network drops, navigations and Server Actions wait and retry
    // instead of failing, so a meal logged in a dead spot is saved once the
    // connection returns. Paired with client-generated ids, a retry can never
    // double-log. See components/shell/offline-banner.tsx.
    useOffline: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=(), payment=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
