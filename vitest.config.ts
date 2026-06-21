import { defineConfig } from "vitest/config";

/**
 * Root Vitest config. The repo wires workspace packages via package.json
 * `exports` (workspace:*), NOT tsconfig path aliases, so map each @directory/*
 * specifier to its TS source here. Vite resolves `.ts` ESM imports natively.
 *
 * Two tiers of tests:
 *  - PURE (no DB): net-guard, webhook sign/verify — run anywhere.
 *  - DB-touching: api-keys, IDOR — guarded by DATABASE_URL (skipped if unset),
 *    and db-setup.ts refuses to run unless the URL is localhost/127.0.0.1.
 */
const pkg = (p: string) => new URL(p, import.meta.url).pathname;

export default defineConfig({
  resolve: {
    alias: {
      "@directory/config": pkg("./packages/config/src/index.ts"),
      "@directory/contracts": pkg("./packages/contracts/src/index.ts"),
      "@directory/db": pkg("./packages/db/src/index.ts"),
      "@directory/core": pkg("./packages/core/src/index.ts"),
      "@directory/analytics": pkg("./packages/analytics/src/index.ts"),
      "@directory/ai": pkg("./packages/ai/src/index.ts"),
      "@directory/auth": pkg("./packages/auth/src/index.ts"),
      "@directory/billing": pkg("./packages/billing/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    globals: false,
    testTimeout: 20_000,
    include: ["packages/**/*.test.ts", "apps/**/src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**", "**/.turbo/**"],
  },
});
