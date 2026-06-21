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

export * from "./jsonld.ts";
