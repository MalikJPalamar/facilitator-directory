import { db, sql } from "@directory/db";
import type { Context, MiddlewareHandler } from "hono";

import { fail } from "../errors.ts";

/**
 * Postgres fixed-window rate limiter (no Redis). One atomic upsert per request
 * keyed by (subject, route-class, window bucket). Per-key for authed callers,
 * per-IP for anonymous. Heavier limits on writes/search than reads.
 *
 * Fails OPEN: a transient DB error must never take the API down — Vercel's
 * platform firewall is the volumetric backstop. Mount AFTER tenant() so
 * c.var.tenant.keyId is populated (per-key vs per-IP bucketing).
 */

type RouteClass = "read" | "write" | "search";
const LIMITS: Record<RouteClass, { limit: number; windowMs: number }> = {
  read: { limit: 300, windowMs: 60_000 },
  search: { limit: 60, windowMs: 60_000 },
  write: { limit: 30, windowMs: 60_000 },
};

function classify(method: string, path: string): RouteClass {
  if (method === "POST" || method === "PATCH" || method === "DELETE") return "write";
  if (path.endsWith("/search")) return "search";
  return "read";
}

/** Same forwarded-header trust as app.ts originOf(); Vercel sets these at edge. */
function clientIp(c: Context): string {
  const real = c.req.header("x-real-ip");
  if (real) return real.trim();
  const xff = c.req.header("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim(); // left-most = original client
  return "unknown";
}

export const rateLimit = (): MiddlewareHandler => async (c, next) => {
  const routeClass = classify(c.req.method, new URL(c.req.url).pathname);
  const { limit, windowMs } = LIMITS[routeClass];
  const keyId = c.get("tenant")?.keyId;
  const subject = keyId ? `key:${keyId}` : `ip:${clientIp(c)}`;
  const windowStartMs = Math.floor(Date.now() / windowMs) * windowMs;
  const windowStart = new Date(windowStartMs);
  const resetSec = Math.ceil((windowStartMs + windowMs) / 1000);

  let count: number;
  try {
    const rows = (await db.execute(sql`
      insert into rate_limit (subject, route_class, window_start, count, updated_at)
      values (${subject}, ${routeClass}, ${windowStart.toISOString()}, 1, now())
      on conflict (subject, route_class, window_start)
      do update set count = rate_limit.count + 1, updated_at = now()
      returning count
    `)) as unknown as { count: number }[];
    count = Number(rows[0]?.count ?? 1);
  } catch (err) {
    // FAIL OPEN — never let the limiter's DB dependency take the API down.
    console.error(
      JSON.stringify({
        level: "error",
        msg: "rate_limit_db_error",
        requestId: c.get("requestId"),
        err: (err as Error).message,
      }),
    );
    return next();
  }

  const remaining = Math.max(0, limit - count);
  c.header("RateLimit-Limit", String(limit));
  c.header("RateLimit-Remaining", String(remaining));
  c.header("RateLimit-Reset", String(resetSec)); // unix seconds

  if (count > limit) {
    c.header("Retry-After", String(Math.max(1, resetSec - Math.ceil(Date.now() / 1000))));
    return fail(
      c,
      429,
      "rate_limited",
      `rate limit exceeded for ${routeClass} requests; retry after the window resets`,
    );
  }
  return next();
};
