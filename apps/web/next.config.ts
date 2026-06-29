import type { NextConfig } from "next";

const config: NextConfig = {
  // Workspace packages are shipped as TypeScript source, so Next must transpile
  // them. The embedded REST API (mounted at /api) pulls in the full domain stack.
  transpilePackages: [
    "@directory/api",
    "@directory/core",
    "@directory/db",
    "@directory/ai",
    "@directory/analytics",
    "@directory/billing",
    "@directory/config",
    "@directory/contracts",
    "@directory/mcp",
    "@directory/auth",
    "@directory/worker",
  ],
  // Keep node-oriented libs out of the bundle (dynamic require / native bits).
  serverExternalPackages: ["postgres", "stripe", "dotenv", "better-auth"],
  // Security headers. Baseline everywhere; the admin/superadmin surfaces carry
  // reveal-once secrets (API keys, webhook secrets) in the URL, so they get
  // `no-referrer` (never leak the query via Referer) + anti-clickjacking. The
  // public directory is deliberately left frameable for the embed integration.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      {
        source: "/superadmin/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default config;
