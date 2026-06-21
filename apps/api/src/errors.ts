import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * One error envelope for every machine route — `{ error: { code, message } }` —
 * so agents and CRMs code against a single, stable error shape (mirrored by the
 * ErrorEnvelope contract in @directory/contracts and documented in OpenAPI).
 */
export type ErrCode =
  | "unauthorized"
  | "insufficient_scope"
  | "not_found"
  | "validation_error"
  | "conflict"
  | "rate_limited"
  | "internal";

export function fail(
  c: Context,
  status: ContentfulStatusCode,
  code: ErrCode,
  message: string,
  details?: unknown,
) {
  return c.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    status,
  );
}
