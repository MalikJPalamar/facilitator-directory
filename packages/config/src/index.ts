import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";

import { config as loadDotenv } from "dotenv";
import { z } from "zod";

/**
 * Load the repo-root `.env` before anything reads process.env.
 *
 * Commands run from a package's own cwd (e.g. `pnpm --filter @directory/db ...`),
 * so we walk up from cwd to the workspace root (marked by pnpm-workspace.yaml)
 * and load its `.env` if present. Real environment variables always win — dotenv
 * does not override already-set vars — so production/CI config is unaffected.
 */
function loadRootEnv(): void {
  let dir = process.cwd();
  const { root } = parse(dir);
  while (true) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) {
      const envPath = join(dir, ".env");
      if (existsSync(envPath)) loadDotenv({ path: envPath });
      return;
    }
    if (dir === root) {
      // Fallback: a plain `.env` in cwd if no workspace root was found.
      loadDotenv();
      return;
    }
    dir = dirname(dir);
  }
}

loadRootEnv();

/**
 * Centralised, validated configuration for every service in the monorepo.
 *
 * We intentionally keep this permissive (most values optional with sensible
 * local-dev defaults) so the scaffold boots without a fully populated `.env`,
 * while still surfacing a typed config object. Production deployments should set
 * every value explicitly.
 */
const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  // Database
  DATABASE_URL: z
    .string()
    .transform(unquote)
    .default("postgres://directory:directory@localhost:5432/directory"),

  // Auth (Better Auth / OAuth 2.1 / MCP authorization server)
  BETTER_AUTH_SECRET: z.string().default("dev-insecure-secret-change-me"),
  BETTER_AUTH_URL: z.string().default("http://localhost:3000"),

  // AI (Claude)
  ANTHROPIC_API_KEY: z.string().optional(),

  // API
  API_BASE_URL: z.string().default("http://localhost:8787"),
  API_PORT: z.coerce.number().default(8787),

  // MCP
  MCP_PORT: z.coerce.number().default(8788),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID: z.string().optional(),

  // Analytics
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().default("https://us.i.posthog.com"),

  // Search (Typesense — deferred)
  TYPESENSE_HOST: z.string().default("localhost"),
  TYPESENSE_PORT: z.coerce.number().default(8108),
  TYPESENSE_API_KEY: z.string().default("dev-typesense-key"),
});

/**
 * Strip surrounding whitespace and one layer of matching quotes from a value.
 *
 * Dashboards (e.g. Vercel) commonly capture a pasted connection string *with*
 * its surrounding quotes — `"postgresql://…"` — which is a valid string but a
 * malformed URL, so `postgres()`/`new URL()` throw `Invalid URL` at runtime.
 * Real `.env` files are de-quoted by dotenv; this makes raw `process.env` just
 * as forgiving.
 */
function unquote(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && /^(["']).*\1$/s.test(t)) return t.slice(1, -1).trim();
  return t;
}

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

/** Parse + validate process.env once, memoised. */
export function getEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}

export const env: Env = getEnv();
