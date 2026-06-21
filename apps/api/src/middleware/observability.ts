import type { MiddlewareHandler } from "hono";

// Reuse Hono's built-in request-id: honors + emits `X-Request-Id`, rejects
// values >255 chars or containing anything outside [\w\-=] (injection-safe),
// and exposes it as c.var.requestId.
export { requestId } from "hono/request-id";

/**
 * One structured JSON log line per request. Runs FIRST so it times everything
 * and still logs requests that 401 before tenant() resolves. NEVER reads the
 * Authorization header or any secret — it only emits the resolved keyId/org/
 * actor (the dk_/whsec_ plaintext is never in scope here).
 */
export const requestLogger = (): MiddlewareHandler => async (c, next) => {
  const start = performance.now();
  try {
    await next();
  } finally {
    try {
      // Read tenant AFTER next() — undefined for pre-auth failures, which is fine.
      const t = c.get("tenant");
      const line = {
        t: new Date().toISOString(),
        level: c.res.status >= 500 ? "error" : "info",
        requestId: c.get("requestId"),
        method: c.req.method,
        path: new URL(c.req.url).pathname,
        status: c.res.status,
        ms: Math.round(performance.now() - start),
        org: t?.organizationId,
        actor: t?.actor,
        keyId: t?.keyId, // uuid, never the secret
      };
      console.log(JSON.stringify(line));
    } catch {
      /* logging must never break the response */
    }
  }
};
