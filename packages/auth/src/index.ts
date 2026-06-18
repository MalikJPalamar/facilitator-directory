import { env } from "@directory/config";
import { db } from "@directory/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

/**
 * Better Auth — the platform's identity layer AND its OAuth 2.1 authorization
 * server (which is what makes the MCP server a proper OAuth resource server).
 *
 * - Organization plugin: schools = organizations, graduates = members, roles
 *   owner/admin/graduate. The active organization is the tenant claim every
 *   request is scoped by.
 * - Runs on the same Postgres as everything else (single Drizzle source of truth).
 *
 * NEXT STEP (documented, not wired this scaffold): add the OAuth 2.1 Provider /
 * MCP plugin so this issues access tokens carrying `active_organization_id` +
 * scopes. The `oauth_application` / `oauth_access_token` / `oauth_consent` tables
 * already exist in the schema for it. The API's tenant middleware then validates
 * those Bearer tokens instead of the scaffold `x-org-id` header.
 */
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  plugins: [
    organization({
      // Roles within a school.
      roles: ["owner", "admin", "graduate"] as unknown as never,
    }),
  ],
});

export type Auth = typeof auth;
