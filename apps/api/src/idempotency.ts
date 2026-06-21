import { createHash } from "node:crypto";

import { and, db, eq, tables } from "@directory/db";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { Tenant } from "./middleware/tenant.ts";

/**
 * Safe write retries. When a caller sends an `Idempotency-Key` header, the first
 * completed response is stored keyed by (scopeHash, key) and any retry replays
 * it verbatim instead of writing again — so a CRM that retries on a network blip
 * never double-creates a lead. Without the header, the handler just runs.
 *
 * scopeHash binds the key to the org + key/user + method + path, so the same
 * idempotency key can be reused safely across different orgs/endpoints.
 */
export async function withIdempotency(
  c: Context,
  ctx: Tenant,
  handler: () => Promise<{ status: number; body: Record<string, unknown> }>,
  /**
   * The validated request payload. Folded into the idempotency scope so the SAME
   * key with a DIFFERENT body is a distinct operation and can't replay a stale
   * response (e.g. minting a key or issuing a claim for the wrong target). The
   * route already parsed the body, so we hash that rather than re-reading the
   * (now-consumed) request stream.
   */
  idemBody?: unknown,
) {
  const key = c.req.header("idempotency-key");
  if (!key) {
    const r = await handler();
    return c.json(r.body, r.status as ContentfulStatusCode);
  }

  const bodyHash = createHash("sha256")
    .update(JSON.stringify(idemBody ?? null))
    .digest("hex");
  const principal = ctx.keyId ?? ctx.organizationId ?? "anon";
  const scopeHash = createHash("sha256")
    .update(
      `${ctx.organizationId}|${principal}|${c.req.method}|${new URL(c.req.url).pathname}|${bodyHash}`,
    )
    .digest("hex");

  const [existing] = await db
    .select()
    .from(tables.idempotencyKey)
    .where(
      and(
        eq(tables.idempotencyKey.scopeHash, scopeHash),
        eq(tables.idempotencyKey.key, key),
      ),
    )
    .limit(1);
  if (existing) {
    return c.json(
      existing.responseBody,
      existing.statusCode as ContentfulStatusCode,
    );
  }

  const r = await handler();
  await db
    .insert(tables.idempotencyKey)
    .values({ scopeHash, key, statusCode: r.status, responseBody: r.body })
    .onConflictDoNothing({
      target: [tables.idempotencyKey.scopeHash, tables.idempotencyKey.key],
    });
  return c.json(r.body, r.status as ContentfulStatusCode);
}
