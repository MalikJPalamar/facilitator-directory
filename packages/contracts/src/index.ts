import { z } from "zod";

/**
 * The wire contract — shared by apps/api (which builds OpenAPI from these),
 * apps/web, apps/mcp, and the distribution adapters. Define the shape once so
 * request/response shapes can't drift across surfaces.
 */

// ── Public directory ──────────────────────────────────────────────────────────

export const ProfileSummary = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  displayName: z.string(),
  headline: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  modalities: z.array(z.string()),
  city: z.string().nullable(),
  country: z.string().nullable(),
  offersOnline: z.boolean(),
  acceptingClients: z.boolean(),
  verified: z.boolean(),
  /** Geo distance in km when the query supplied a location. */
  distanceKm: z.number().nullable().optional(),
  /** Semantic relevance score when the query supplied text. */
  relevance: z.number().nullable().optional(),
});
export type ProfileSummary = z.infer<typeof ProfileSummary>;

export const ProfileDetail = ProfileSummary.extend({
  bio: z.string().nullable(),
  gallery: z.array(z.string()),
  pricing: z.record(z.unknown()),
  links: z.record(z.string()),
  certifications: z.array(
    z.object({
      programName: z.string(),
      level: z.string().nullable(),
      verified: z.boolean(),
    }),
  ),
});
export type ProfileDetail = z.infer<typeof ProfileDetail>;

/**
 * Query-string boolean. `z.coerce.boolean()` is JS-truthiness based, so the
 * string "false" coerces to `true`; here only explicit truthy tokens enable the
 * flag, and "false"/"0"/"no" correctly disable it.
 */
const booleanFlag = z
  .preprocess((v) => {
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return ["1", "true", "yes", "on"].includes(v.toLowerCase());
    return v;
  }, z.boolean())
  .optional();

export const SearchQuery = z.object({
  q: z.string().optional(),
  modality: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radiusKm: z.coerce.number().default(50),
  online: booleanFlag,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchQuery = z.infer<typeof SearchQuery>;

export const SearchResult = z.object({
  results: z.array(ProfileSummary),
  page: z.number(),
  pageSize: z.number(),
  total: z.number(),
});
export type SearchResult = z.infer<typeof SearchResult>;

export const SchoolPublic = z.object({
  slug: z.string(),
  name: z.string(),
  logo: z.string().nullable(),
  themeColor: z.string().nullable(),
  heroCopy: z.string().nullable(),
});
export type SchoolPublic = z.infer<typeof SchoolPublic>;

// ── Profile editing (graduate) ────────────────────────────────────────────────

export const ProfileStatus = z.enum(["draft", "published", "hidden"]);
export type ProfileStatus = z.infer<typeof ProfileStatus>;

export const ProfileUpdate = z.object({
  headline: z.string().max(160).optional(),
  bio: z.string().max(4000).optional(),
  pricing: z.record(z.unknown()).optional(),
  // Public links: a website, when present, must be a valid URL.
  links: z.object({ website: z.string().url() }).partial().catchall(z.string()).optional(),
  acceptingClients: z.boolean().optional(),
  theme: z.record(z.unknown()).optional(),
  status: ProfileStatus.optional(),
});
export type ProfileUpdate = z.infer<typeof ProfileUpdate>;

// ── AI insights ───────────────────────────────────────────────────────────────

export const NextBestAction = z.object({
  action: z.string(),
  rationale: z.string(),
  targetMetric: z.string(),
  effort: z.enum(["low", "medium", "high"]),
});

export const InsightDTO = z.object({
  id: z.string().uuid(),
  scope: z.enum(["graduate", "school"]),
  version: z.number(),
  narrative: z.string(),
  nextBestActions: z.array(NextBestAction),
  metrics: z.record(z.number()),
  outcome: z
    .object({
      verdict: z.enum(["improved", "flat", "regressed", "inconclusive"]),
      delta: z.record(z.number()),
    })
    .nullable(),
  source: z.string().optional(),
  createdAt: z.string(),
});
export type InsightDTO = z.infer<typeof InsightDTO>;

// ── Machine API: scopes, errors, webhooks, write/ingest ────────────────────────

/**
 * Scopes an org-scoped API key can carry. Public read routes need no token;
 * a token still grants attribution. Writes require the matching scope.
 */
export const SCOPES = {
  directoryRead: "directory:read",
  insightsRead: "insights:read",
  leadsWrite: "leads:write",
  profilesWrite: "profiles:write",
  rosterAdmin: "roster:admin",
} as const;
export const ALL_SCOPES = Object.values(SCOPES);
export type Scope = (typeof ALL_SCOPES)[number];

/** Single error envelope for every machine route (agents code against this). */
export const ErrorEnvelope = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;

/** Canonical outbound event names a CRM can subscribe to. */
export const WEBHOOK_EVENTS = [
  "profile.claimed",
  "profile.published",
  "profile.updated",
  "contact.requested",
  "lead.created",
  "search.performed",
] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export const WebhookEndpointInput = z.object({
  url: z.string().url().refine((u) => u.startsWith("https://"), {
    message: "url must be https://",
  }),
  // [] / ["*"] = all events; else a subset of WEBHOOK_EVENTS.
  events: z.array(z.enum(WEBHOOK_EVENTS)).default([]),
  description: z.string().max(200).optional(),
});
export type WebhookEndpointInput = z.infer<typeof WebhookEndpointInput>;

export const WebhookEndpointView = z.object({
  id: z.string().uuid(),
  url: z.string(),
  events: z.array(z.string()),
  enabled: z.boolean(),
  description: z.string().nullable(),
  createdAt: z.string(),
});
export type WebhookEndpointView = z.infer<typeof WebhookEndpointView>;

// ── Inbound leads (written by agents/CRMs) ─────────────────────────────────────

export const LeadCreate = z
  .object({
    // target a graduate; omit => school-level lead
    profileSlug: z.string().optional(),
    contactName: z.string().max(200).optional(),
    contactEmail: z.string().email().optional(),
    contactPhone: z.string().max(40).optional(),
    message: z.string().max(4000).optional(),
    kind: z
      .enum(["contact_request", "booking_intent", "inquiry"])
      .default("contact_request"),
    source: z.string().max(80).optional(), // e.g. "crm:hubspot"
    props: z.record(z.unknown()).optional(),
  })
  .refine((v) => v.contactEmail || v.contactPhone || v.message, {
    message: "at least one of contactEmail, contactPhone, message is required",
  });
export type LeadCreate = z.infer<typeof LeadCreate>;

export const Lead = z.object({
  id: z.string().uuid(),
  kind: z.string(),
  status: z.string(),
  createdAt: z.string(),
});
export type Lead = z.infer<typeof Lead>;

// ── Bulk roster import (admin scope) ───────────────────────────────────────────

export const RosterFacilitator = z.object({
  slug: z.string(),
  displayName: z.string(),
  email: z.string().email().optional(),
  headline: z.string().optional(),
  bio: z.string().optional(),
  modalities: z.array(z.string()).optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  online: z.boolean().optional(),
  program: z.string().optional(),
});
export type RosterFacilitator = z.infer<typeof RosterFacilitator>;

export const RosterImport = z.object({
  facilitators: z.array(RosterFacilitator).min(1).max(500),
  issueClaimLinks: z.boolean().default(false),
});
export type RosterImport = z.infer<typeof RosterImport>;

export const RosterImportResult = z.object({
  created: z.number(),
  updated: z.number(),
  skipped: z.number(),
  profiles: z.array(
    z.object({
      slug: z.string(),
      id: z.string().uuid(),
      status: z.string(),
      claimUrl: z.string().optional(),
    }),
  ),
});
export type RosterImportResult = z.infer<typeof RosterImportResult>;

export * from "./jsonld.ts";
