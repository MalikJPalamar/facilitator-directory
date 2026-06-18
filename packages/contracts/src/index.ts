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

export const SearchQuery = z.object({
  q: z.string().optional(),
  modality: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  radiusKm: z.coerce.number().default(50),
  online: z.coerce.boolean().optional(),
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

export const ProfileUpdate = z.object({
  headline: z.string().max(160).optional(),
  bio: z.string().max(4000).optional(),
  pricing: z.record(z.unknown()).optional(),
  links: z.record(z.string()).optional(),
  acceptingClients: z.boolean().optional(),
  theme: z.record(z.unknown()).optional(),
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

export * from "./jsonld.ts";
