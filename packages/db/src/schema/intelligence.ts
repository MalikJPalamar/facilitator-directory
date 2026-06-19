import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { organization } from "./auth.ts";
import { graduateProfile } from "./marketplace.ts";

/**
 * THE SPINE. Append-only behavioral event stream. Every interaction — human or
 * agent — emits one row. PostHog is the analytics sink; this is the durable,
 * ownable stream the AI insights loop, incentive algorithm, and ads marketplace
 * read from.
 *
 * Production note: partition BY RANGE (occurred_at) monthly. Drizzle emits a
 * plain table; the partitioning is applied in a follow-up migration. Indexed for
 * the per-tenant / per-graduate slice the nightly loop reads.
 */
export const analyticsEvent = pgTable(
  "analytics_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id").references(() => graduateProfile.id, {
      onDelete: "set null",
    }),
    // profile_view | search | contact_click | booking_intent | agent_query | ...
    eventType: text("event_type").notNull(),
    // 'human' | 'agent' — first-class capture of agents-as-customers.
    actor: text("actor").notNull().default("human"),
    props: jsonb("props").$type<Record<string, unknown>>().default({}),
    sessionId: text("session_id"),
    correlationId: text("correlation_id"),
    occurredAt: timestamp("occurred_at").notNull().defaultNow(),
  },
  (t) => [
    index("analytics_event_org_time_idx").on(t.organizationId, t.occurredAt),
    index("analytics_event_profile_time_idx").on(t.profileId, t.occurredAt),
    index("analytics_event_type_idx").on(t.eventType),
  ],
);

export type NextBestAction = {
  action: string;
  rationale: string;
  /** Which metric this action is expected to move, e.g. "profile_views". */
  targetMetric: string;
  effort: "low" | "medium" | "high";
};

/** Snapshot of the metrics the insight was generated from. */
export type InsightMetrics = Record<string, number>;

/**
 * The LEARN-loop outcome: how the PREVIOUS version's recommendations actually
 * performed, written by the next nightly run. This is what makes coaching
 * iterative rather than one-shot.
 */
export type InsightOutcome = {
  evaluatedAt: string;
  previousTargetMetrics: string[];
  before: InsightMetrics;
  after: InsightMetrics;
  /** Per-metric delta (after - before). */
  delta: InsightMetrics;
  actedOn: boolean;
  verdict: "improved" | "flat" | "regressed" | "inconclusive";
};

/**
 * AI-generated narrative insight + ranked next-best-actions for a graduate or a
 * school. VERSIONED — every nightly run writes a new version; the prior version
 * is updated with its measured `outcome`.
 */
export const insight = pgTable(
  "insight",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    // null => school-level insight; set => graduate-level.
    profileId: uuid("profile_id").references(() => graduateProfile.id, {
      onDelete: "cascade",
    }),
    scope: text("scope").notNull(), // 'graduate' | 'school'
    version: integer("version").notNull().default(1),
    // draft | published
    status: text("status").notNull().default("published"),
    narrative: text("narrative").notNull(),
    nextBestActions: jsonb("next_best_actions")
      .$type<NextBestAction[]>()
      .notNull()
      .default([]),
    metrics: jsonb("metrics").$type<InsightMetrics>().notNull().default({}),
    outcome: jsonb("outcome").$type<InsightOutcome | null>(),
    model: text("model"),
    correlationId: text("correlation_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("insight_org_idx").on(t.organizationId),
    index("insight_profile_version_idx").on(t.profileId, t.version),
  ],
);

/** Searchable Logs (GOVERN/ASSURE pillar): every Claude call, keyed by correlation_id. */
export const aiCallLog = pgTable(
  "ai_call_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    correlationId: text("correlation_id").notNull(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    profileId: uuid("profile_id"),
    purpose: text("purpose").notNull(), // 'insight' | 'moderation' | 'rationale' | ...
    model: text("model").notNull(),
    promptRef: text("prompt_ref"),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    latencyMs: integer("latency_ms"),
    status: text("status").notNull().default("ok"), // ok | error | refusal
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("ai_call_log_correlation_idx").on(t.correlationId)],
);

/**
 * Human-review queue (GOVERN/ASSURE pillar): any AI/agent-suggested change to
 * PUBLISHED content lands here instead of auto-applying. "Humans above the loop."
 */
export const reviewItem = pgTable(
  "review_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id").references(() => graduateProfile.id, {
      onDelete: "cascade",
    }),
    kind: text("kind").notNull(), // 'profile_change_suggestion' | ...
    proposedBy: text("proposed_by").notNull(), // 'agent' | 'ai'
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status").notNull().default("pending"), // pending | approved | rejected
    correlationId: text("correlation_id"),
    decidedBy: text("decided_by"),
    decidedAt: timestamp("decided_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("review_item_org_status_idx").on(t.organizationId, t.status)],
);

// ── Future-ready stubs (schema reserved; no compute/UI this session) ──

export const incentiveScore = pgTable("incentive_score", {
  id: uuid("id").primaryKey().defaultRandom(),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => graduateProfile.id, { onDelete: "cascade" }),
  period: text("period").notNull(),
  score: doublePrecision("score").notNull().default(0),
  components: jsonb("components").$type<Record<string, number>>().default({}),
  computedAt: timestamp("computed_at").notNull().defaultNow(),
});

export const adPlacement = pgTable("ad_placement", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id").references(() => graduateProfile.id, {
    onDelete: "cascade",
  }),
  slot: text("slot").notNull(),
  weight: doublePrecision("weight").notNull().default(1),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  status: text("status").notNull().default("inactive"),
  enabled: boolean("enabled").notNull().default(false),
});
