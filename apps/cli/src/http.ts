import { randomUUID } from "node:crypto";

import type { Ctx } from "./config.ts";

/**
 * A non-2xx response from the REST API, decoded from the single error envelope
 * `{ error: { code, message, details? } }`. `status` 0 is reserved for failures
 * that never reached the server (e.g. a required key was missing).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type ApiRequest = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** Query params; undefined/null values are dropped, others stringified. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** JSON request body (serialized + content-type set on writes). */
  body?: unknown;
  /** Override the auto Idempotency-Key on writes. */
  idempotencyKey?: string;
  /** Throw before any network call when no API key is configured. */
  requireKey?: boolean;
};

/**
 * The whole transport: every CLI request goes through here. Builds
 * `${baseUrl}/api${path}` (baseUrl already has its trailing slash stripped and
 * does NOT include `/api`), attaches the Bearer key when present, auto-stamps an
 * Idempotency-Key on non-GET writes (overridable), and normalizes failures into
 * ApiError. All 2xx (200/201/202/…) are treated as success.
 */
export async function api<T = unknown>(
  ctx: Ctx,
  path: string,
  req: ApiRequest = {},
): Promise<T> {
  const method = req.method ?? "GET";

  // Public commands tolerate a missing key; authed ones fail fast and friendly
  // BEFORE touching the network so the user gets a clear next step.
  if (req.requireKey && !ctx.key) {
    throw new ApiError(
      0,
      "unauthorized",
      "this command needs an API key — pass --key <key> or set DIRECTORY_API_KEY",
    );
  }

  const url = new URL(`${ctx.baseUrl}/api${path}`);
  if (req.query) {
    for (const [k, v] of Object.entries(req.query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = { accept: "application/json" };
  if (ctx.key) headers.authorization = `Bearer ${ctx.key}`;

  const init: RequestInit = { method, headers };
  if (req.body !== undefined && method !== "GET") {
    headers["content-type"] = "application/json";
    init.body = JSON.stringify(req.body);
  }
  // Auto idempotency on every mutating verb, overridable by the caller.
  if (method !== "GET") {
    headers["idempotency-key"] = req.idempotencyKey ?? randomUUID();
  }

  const res = await fetch(url, init);

  // 204 / empty body → return undefined cast to T (callers expecting a body
  // won't hit this path; the API replies with JSON envelopes everywhere).
  const text = await res.text();
  const data: unknown = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const env = data as { error?: { code?: string; message?: string; details?: unknown } } | undefined;
    const code = env?.error?.code ?? "http_error";
    const message = env?.error?.message ?? `request failed (${res.status})`;
    throw new ApiError(res.status, code, message, env?.error?.details);
  }

  return data as T;
}

/** Parse JSON without throwing — non-JSON bodies surface as a raw string. */
function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
