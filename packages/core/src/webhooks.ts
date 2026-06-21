import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import type { WebhookEvent } from "@directory/contracts";
import { and, db, eq, inArray, sql, tables } from "@directory/db";

import { assertPublicHttpsUrl } from "./net-guard.ts";

export { BlockedUrlError } from "./net-guard.ts";

/**
 * Outbound webhooks — push directory events to a school's CRM. Each event is
 * fanned out to every enabled endpoint whose filter matches; one durable
 * `webhook_delivery` row is written per endpoint, then the POST fires WITHOUT
 * being awaited (serverless fire-and-forget). The nightly sweep is the real
 * at-least-once guarantee, retrying any delivery that didn't succeed.
 *
 * Signing is Stripe-style: HMAC-SHA256 over `${timestamp}.${rawBody}`, sent as
 * `directory-signature: t=<unix>,v1=<hex>`. The shared `directory-id` header is
 * the consumer's idempotency key.
 */

const TIMEOUT_MS = 10_000;
const SWEEP_LIMIT = 200;
// Backoff per attempt# (minutes): ~1m, 5m, 30m, 2h, 6h. attempts>=max => give up.
const BACKOFF_MIN = [1, 5, 30, 120, 360];

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString("hex")}`;
}

/** Stripe-style signature header value for a given secret + body + timestamp. */
export function signPayload(secret: string, body: string, tsSec: number): string {
  const sig = createHmac("sha256", secret)
    .update(`${tsSec}.${body}`)
    .digest("hex");
  return `t=${tsSec},v1=${sig}`;
}

/** Verify a `directory-signature` header (also exported for tests/receivers). */
export function verifySignature(
  secret: string,
  rawBody: string,
  header: string,
  toleranceSec = 300,
): boolean {
  // Parse defensively — a malformed header (missing t/v1, stray '='/commas) must
  // cleanly return false, never throw (receivers reuse this on attacker input).
  if (typeof header !== "string") return false;
  const parts: Record<string, string> = {};
  for (const segment of header.split(",")) {
    const eq = segment.indexOf("=");
    if (eq <= 0) continue;
    parts[segment.slice(0, eq).trim()] = segment.slice(eq + 1).trim();
  }
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !t) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  if (!parts.v1) return false;
  const expected = createHmac("sha256", secret)
    .update(`${t}.${rawBody}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

type EmitInput = {
  organizationId: string;
  type: WebhookEvent;
  data: Record<string, unknown>;
};

/**
 * Fan one event out to every enabled, matching endpoint. Never throws into the
 * caller's request path — callers should `void emit(...)`.
 */
export async function emit(input: EmitInput): Promise<void> {
  try {
    const endpoints = await db
      .select()
      .from(tables.webhookEndpoint)
      .where(
        and(
          eq(tables.webhookEndpoint.organizationId, input.organizationId),
          eq(tables.webhookEndpoint.enabled, true),
        ),
      );
    const matched = endpoints.filter(
      (e) =>
        e.events.length === 0 ||
        e.events.includes("*") ||
        e.events.includes(input.type),
    );
    if (matched.length === 0) return;

    const eventId = randomUUID();
    const occurredAt = new Date().toISOString();
    for (const ep of matched) {
      const payload = {
        id: eventId,
        type: input.type,
        occurredAt,
        organizationId: input.organizationId,
        data: input.data,
      };
      const [row] = await db
        .insert(tables.webhookDelivery)
        .values({
          organizationId: input.organizationId,
          endpointId: ep.id,
          eventId,
          eventType: input.type,
          payload,
        })
        .returning({ id: tables.webhookDelivery.id });
      if (row) void deliverOne(row.id).catch(() => {});
    }
  } catch (err) {
    console.error("webhook emit failed (non-fatal):", err);
  }
}

/** Deliver one pending/failed row; record outcome + schedule next attempt. */
async function deliverOne(deliveryId: string): Promise<void> {
  const [d] = await db
    .select()
    .from(tables.webhookDelivery)
    .where(eq(tables.webhookDelivery.id, deliveryId))
    .limit(1);
  if (!d || d.status === "succeeded") return;
  const [ep] = await db
    .select()
    .from(tables.webhookEndpoint)
    .where(
      and(
        eq(tables.webhookEndpoint.id, d.endpointId),
        // Org-scope the lookup explicitly. RLS is not enforced for the runtime
        // DB role (owner), so this WHERE — not a policy — is the tenant boundary
        // that guarantees a delivery only ever uses its own org's endpoint.
        eq(tables.webhookEndpoint.organizationId, d.organizationId),
      ),
    )
    .limit(1);
  if (!ep || !ep.enabled) return;

  const attempt = d.attempts + 1;
  // Re-check the target at delivery time so a DNS-rebind (public at register,
  // private now) cannot turn a stored endpoint into an SSRF on retry.
  try {
    await assertPublicHttpsUrl(ep.url);
  } catch (err) {
    await scheduleRetry(
      d.id,
      attempt,
      d.maxAttempts,
      null,
      err instanceof Error ? err.message : "blocked target",
    );
    return;
  }

  const body = JSON.stringify(d.payload);
  const ts = Math.floor(Date.now() / 1000);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ep.url, {
      method: "POST",
      signal: ctrl.signal,
      // Don't follow redirects: a 30x could bounce the signed POST to an
      // internal URL AFTER the assertPublicHttpsUrl check (DNS-rebind / SSRF).
      redirect: "manual",
      headers: {
        "content-type": "application/json",
        "directory-signature": signPayload(ep.secret, body, ts),
        "directory-id": d.eventId,
        "directory-event": d.eventType,
      },
      body,
    });
    if (res.ok) {
      await db
        .update(tables.webhookDelivery)
        .set({
          status: "succeeded",
          attempts: attempt,
          lastStatusCode: res.status,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(tables.webhookDelivery.id, d.id));
      return;
    }
    await scheduleRetry(d.id, attempt, d.maxAttempts, res.status, `HTTP ${res.status}`);
  } catch (err) {
    await scheduleRetry(
      d.id,
      attempt,
      d.maxAttempts,
      null,
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    clearTimeout(timer);
  }
}

async function scheduleRetry(
  id: string,
  attempt: number,
  max: number,
  code: number | null,
  error: string,
): Promise<void> {
  const exhausted = attempt >= max;
  const mins = BACKOFF_MIN[Math.min(attempt - 1, BACKOFF_MIN.length - 1)] ?? 360;
  await db
    .update(tables.webhookDelivery)
    .set({
      status: exhausted ? "failed" : "pending",
      attempts: attempt,
      lastStatusCode: code ?? null,
      lastError: error,
      nextAttemptAt: new Date(Date.now() + mins * 60_000),
      updatedAt: new Date(),
    })
    .where(eq(tables.webhookDelivery.id, id));
}

/** Retry due deliveries. Called from the nightly cron (and any fast sweep cron). */
export async function sweepWebhookDeliveries(now = new Date()): Promise<number> {
  const due = await db
    .select({ id: tables.webhookDelivery.id })
    .from(tables.webhookDelivery)
    .where(
      and(
        inArray(tables.webhookDelivery.status, ["pending", "failed"]),
        sql`${tables.webhookDelivery.attempts} < ${tables.webhookDelivery.maxAttempts}`,
        // postgres.js can't bind a JS Date as a query param here — pass ISO text.
        sql`${tables.webhookDelivery.nextAttemptAt} <= ${now.toISOString()}`,
      ),
    )
    .limit(SWEEP_LIMIT);
  for (const r of due) await deliverOne(r.id); // sequential: bounded serverless cost
  return due.length;
}

// ── Endpoint CRUD (admin) ──────────────────────────────────────────────────────

export type WebhookEndpointRow = {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  description: string | null;
  createdAt: Date;
};

export async function listWebhookEndpoints(
  organizationId: string,
): Promise<WebhookEndpointRow[]> {
  return db
    .select({
      id: tables.webhookEndpoint.id,
      url: tables.webhookEndpoint.url,
      events: tables.webhookEndpoint.events,
      enabled: tables.webhookEndpoint.enabled,
      description: tables.webhookEndpoint.description,
      createdAt: tables.webhookEndpoint.createdAt,
    })
    .from(tables.webhookEndpoint)
    .where(eq(tables.webhookEndpoint.organizationId, organizationId));
}

/** Register an endpoint. Returns the signing secret ONCE for the admin to copy. */
export async function createWebhookEndpoint(input: {
  organizationId: string;
  url: string;
  events: string[];
  description?: string;
}): Promise<{ id: string; secret: string }> {
  // SSRF guard: reject endpoints that resolve to private/metadata addresses.
  await assertPublicHttpsUrl(input.url);
  const secret = generateWebhookSecret();
  const [row] = await db
    .insert(tables.webhookEndpoint)
    .values({
      organizationId: input.organizationId,
      url: input.url,
      secret,
      events: input.events,
      description: input.description ?? null,
    })
    .returning({ id: tables.webhookEndpoint.id });
  return { id: row!.id, secret };
}

export async function setWebhookEndpointEnabled(
  organizationId: string,
  endpointId: string,
  enabled: boolean,
): Promise<boolean> {
  const rows = await db
    .update(tables.webhookEndpoint)
    .set({ enabled, updatedAt: new Date() })
    .where(
      and(
        eq(tables.webhookEndpoint.id, endpointId),
        eq(tables.webhookEndpoint.organizationId, organizationId),
      ),
    )
    .returning({ id: tables.webhookEndpoint.id });
  return rows.length > 0;
}

export async function rotateWebhookSecret(
  organizationId: string,
  endpointId: string,
): Promise<string | null> {
  const secret = generateWebhookSecret();
  const rows = await db
    .update(tables.webhookEndpoint)
    .set({ secret, updatedAt: new Date() })
    .where(
      and(
        eq(tables.webhookEndpoint.id, endpointId),
        eq(tables.webhookEndpoint.organizationId, organizationId),
      ),
    )
    .returning({ id: tables.webhookEndpoint.id });
  return rows.length ? secret : null;
}

export async function deleteWebhookEndpoint(
  organizationId: string,
  endpointId: string,
): Promise<boolean> {
  const rows = await db
    .delete(tables.webhookEndpoint)
    .where(
      and(
        eq(tables.webhookEndpoint.id, endpointId),
        eq(tables.webhookEndpoint.organizationId, organizationId),
      ),
    )
    .returning({ id: tables.webhookEndpoint.id });
  return rows.length > 0;
}
