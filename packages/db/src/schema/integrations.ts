import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { organization, user } from "./auth.ts";
import { graduateProfile } from "./marketplace.ts";

/**
 * The integration surface — what makes The Directory a *universal*, machine-
 * connectable API rather than just a website. Three concerns live here:
 *
 *   1. `api_key`            — org-scoped Bearer credentials so external agents
 *                             and third-party systems (CRMs) can authenticate.
 *   2. `webhook_endpoint` / `webhook_delivery`
 *                          — outbound events pushed to a school's CRM, signed
 *                             and retried at-least-once.
 *   3. `lead`              — inbound leads written by agents/CRMs.
 *   4. `idempotency_key`   — safe retries for the write endpoints.
 *
 * All but `idempotency_key` are tenant-scoped (organization_id) and get an RLS
 * policy via ORG_SCOPED_TABLES in migrate.ts. `api_key` is deliberately NOT
 * RLS-scoped: it is looked up by key hash *before* any tenant context exists.
 */

// ── Machine authentication ────────────────────────────────────────────────────

/**
 * A first-party, org-scoped API key. The plaintext (`dk_live_…`) is shown to the
 * admin exactly once at creation and never stored; only its SHA-256 hash lives
 * here, so a single indexed lookup resolves a Bearer token to an org + scopes.
 *
 * NOT added to ORG_SCOPED_TABLES: verifyApiKey() must read it by hash before the
 * tenant GUC is set, so an RLS tenant policy would make every lookup return zero
 * rows and silently break all agent auth.
 */
export const apiKey = pgTable(
  "api_key",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    // Public, non-secret display segment, e.g. "dk_live_8f3a2b".
    prefix: text("prefix").notNull(),
    // sha256 hex of the WHOLE plaintext secret.
    keyHash: text("key_hash").notNull().unique(),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    lastUsedAt: timestamp("last_used_at"),
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("api_key_org_idx").on(t.organizationId)],
);

// ── Outbound webhooks (push directory events to a CRM) ─────────────────────────

/** A school's signed outbound webhook endpoint. */
export const webhookEndpoint = pgTable(
  "webhook_endpoint",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    secret: text("secret").notNull(), // whsec_… used to HMAC-sign deliveries
    enabled: boolean("enabled").notNull().default(true),
    // Event filter: [] or ["*"] = all events; else exact event-name match.
    events: jsonb("events").$type<string[]>().notNull().default([]),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("webhook_endpoint_org_idx").on(t.organizationId)],
);

/** One attempt-tracked delivery of one event to one endpoint (at-least-once). */
export const webhookDelivery = pgTable(
  "webhook_delivery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    endpointId: uuid("endpoint_id")
      .notNull()
      .references(() => webhookEndpoint.id, { onDelete: "cascade" }),
    // Shared across the fan-out for one logical event — the consumer's
    // idempotency key (also sent as the `directory-id` header).
    eventId: uuid("event_id").notNull().defaultRandom(),
    eventType: text("event_type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"), // pending|succeeded|failed
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(6),
    nextAttemptAt: timestamp("next_attempt_at").notNull().defaultNow(),
    lastStatusCode: integer("last_status_code"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("webhook_delivery_due_idx").on(t.status, t.nextAttemptAt),
    index("webhook_delivery_endpoint_idx").on(t.endpointId),
  ],
);

// ── Inbound leads (written by agents/CRMs) ─────────────────────────────────────

/** An inbound lead/contact request, written via the authenticated write API. */
export const lead = pgTable(
  "lead",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // null => lead for the school as a whole; set => targeted at one graduate.
    profileId: uuid("profile_id").references(() => graduateProfile.id, {
      onDelete: "set null",
    }),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),
    contactPhone: text("contact_phone"),
    message: text("message"),
    // contact_request | booking_intent | inquiry
    kind: text("kind").notNull().default("contact_request"),
    // where it came from: 'crm:hubspot' | 'agent' | 'web' | free text
    source: text("source"),
    // new | contacted | converted | spam
    status: text("status").notNull().default("new"),
    props: jsonb("props").$type<Record<string, unknown>>().default({}),
    // The key/user that submitted it, for audit (never trusted for tenant scope).
    submittedBy: text("submitted_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("lead_org_time_idx").on(t.organizationId, t.createdAt),
    index("lead_profile_idx").on(t.profileId),
  ],
);

// ── Idempotency ledger (safe write retries) ────────────────────────────────────

/**
 * Stores the response of a completed write keyed by (scopeHash, key) so a CRM
 * retry replays the original result instead of double-writing. Not org-scoped
 * via RLS — the scope is encoded in scopeHash (org|user|method|path).
 */
export const idempotencyKey = pgTable(
  "idempotency_key",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scopeHash: text("scope_hash").notNull(), // sha256(orgId|principal|method|path)
    key: text("key").notNull(),
    statusCode: integer("status_code").notNull(),
    responseBody: jsonb("response_body")
      .$type<Record<string, unknown>>()
      .notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("idempotency_key_uq").on(t.scopeHash, t.key)],
);

// ── Rate limiting (Postgres fixed-window; no Redis) ────────────────────────────

/**
 * One counter row per (subject, route_class, window_start). The window bucket is
 * computed app-side; each request does a single atomic INSERT … ON CONFLICT DO
 * UPDATE … RETURNING, so concurrent serverless invocations increment safely.
 * Expired rows are disposable — pruned by the nightly loop.
 *
 * NOT in ORG_SCOPED_TABLES: the subject for anonymous traffic is an IP (no
 * organization_id), and the limiter runs before/without tenant GUC context —
 * same rationale as idempotency_key + api_key.
 */
export const rateLimit = pgTable(
  "rate_limit",
  {
    // "key:<apiKeyId>" for authed callers, "ip:<addr>" for anonymous. Opaque —
    // never the dk_ secret (only the api_key.id is ever used).
    subject: text("subject").notNull(),
    routeClass: text("route_class").notNull(), // read | write | search
    windowStart: timestamp("window_start").notNull(),
    count: integer("count").notNull().default(0),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("rate_limit_window_uq").on(
      t.subject,
      t.routeClass,
      t.windowStart,
    ),
    index("rate_limit_window_idx").on(t.windowStart),
  ],
);
