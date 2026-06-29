import { env } from "@directory/config";
import { db, tables } from "@directory/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";

/**
 * Base URL: use BETTER_AUTH_URL when explicitly set (prod), otherwise leave it
 * undefined so Better Auth infers the origin from each request. One build then
 * works across every Vercel preview + production URL without baking one origin
 * in. (env.BETTER_AUTH_URL carries a localhost default we deliberately bypass.)
 */
const explicitBaseUrl = process.env.BETTER_AUTH_URL;

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
  ...(explicitBaseUrl ? { baseURL: explicitBaseUrl } : {}),
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, { provider: "pg" }),
  emailAndPassword: { enabled: true },
  plugins: [
    organization({
      // Roles within a school are stored as the plain `member.role` string
      // ("owner" | "admin" | "graduate") and read directly by membershipForUser —
      // we never go through Better Auth's access-control `hasPermission` path, so
      // there are no custom Role objects to register. The org *creator* gets
      // "owner"; "admin"/"graduate" rows are written by the roster + claim flows.
      // (The previous `roles: [...] as unknown as never` was the wrong shape for
      // this version's `roles` option — a Record<string, Role>, not a string[] —
      // and is intentionally removed.)
      creatorRole: "owner",
      organizationHooks: {
        /**
         * Mirror a default subscription row the moment a school is created, so
         * every org has a queryable billing state ("none" until checkout) and
         * the admin/billing UI never has to special-case a missing row. The
         * subscription's organization_id is unique, so guard against a
         * duplicate insert (idempotent on retries).
         */
        afterCreateOrganization: async ({ organization: org }) => {
          await db
            .insert(tables.subscription)
            .values({ organizationId: org.id, status: "none", seats: 1 })
            .onConflictDoNothing({
              target: tables.subscription.organizationId,
            });
        },
      },
    }),
  ],
});

export type Auth = typeof auth;
export type Session = typeof auth.$Infer.Session;
