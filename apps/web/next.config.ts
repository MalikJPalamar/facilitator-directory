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
  ],
  // Keep node-oriented libs out of the bundle (dynamic require / native bits).
  serverExternalPackages: ["postgres", "stripe", "dotenv"],
};

export default config;
