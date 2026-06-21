import { env } from "@directory/config";
import { ALL_SCOPES } from "@directory/contracts";
import { verifyApiKey } from "@directory/core";
import type { MiddlewareHandler } from "hono";

import { fail } from "../errors.ts";

/**
 * Resolved caller context for a request. `organizationId` is derived from a
 * validated Bearer API key in production — NEVER from a client-supplied header.
 * The legacy `x-org-id` header path survives only in non-production for the local
 * journey/test kit.
 */
export type Tenant = {
  organizationId?: string;
  profileId?: string;
  scopes: string[];
  actor: "human" | "agent";
  keyId?: string;
};

declare module "hono" {
  interface ContextVariableMap {
    tenant: Tenant;
  }
}

/** Dev-only fallback grants full scopes so the local journey kit keeps working. */
const DEV_SCOPES = [...ALL_SCOPES];

/**
 * Resolve {organizationId, scopes, actor} from:
 *   1. a valid `Authorization: Bearer dk_…` API key (prod + dev), or
 *   2. only when NODE_ENV !== "production": legacy x-org-id headers (dev), or
 *   3. anonymous (public read routes still work; protected routes 401 later).
 *
 * An invalid Bearer key is rejected immediately with 401 — we never silently
 * fall through to anonymous, which would mask a misconfigured client.
 */
export const tenant = (): MiddlewareHandler => async (c, next) => {
  const authz = c.req.header("authorization");
  const bearer = authz?.startsWith("Bearer ") ? authz.slice(7).trim() : undefined;

  if (bearer?.startsWith("dk_")) {
    const key = await verifyApiKey(bearer);
    if (!key) return fail(c, 401, "unauthorized", "invalid or revoked api key");
    c.set("tenant", {
      organizationId: key.organizationId,
      scopes: key.scopes,
      actor: "agent",
      keyId: key.keyId,
    });
    return next();
  }

  if (env.NODE_ENV !== "production") {
    // DEV ONLY: legacy header trust for the local journey/test kit.
    c.set("tenant", {
      organizationId: c.req.header("x-org-id"),
      profileId: c.req.header("x-graduate-profile-id"),
      actor: (c.req.header("x-actor") as "human" | "agent") ?? "human",
      scopes: DEV_SCOPES,
    });
    return next();
  }

  c.set("tenant", { scopes: [], actor: "human" });
  return next();
};

/** Gate a route on org context + a scope. Public routes simply don't use this. */
export const requireScope =
  (scope: string): MiddlewareHandler =>
  async (c, next) => {
    const t = c.var.tenant;
    if (!t?.organizationId)
      return fail(c, 401, "unauthorized", "authentication required");
    if (!t.scopes.includes(scope))
      return fail(c, 403, "insufficient_scope", `requires scope: ${scope}`);
    return next();
  };
