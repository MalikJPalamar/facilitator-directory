import { sql } from "drizzle-orm";
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

import { geographyPoint, vector } from "./_custom.ts";
import { member, organization } from "./auth.ts";

/**
 * A graduate's public listing within ONE school. 1:1 with a `member`.
 * A graduate enrolled at two schools has two profiles — correct, since each is
 * branded per school. `embedding` powers semantic discovery (pgvector).
 */
export const graduateProfile = pgTable(
  "graduate_profile",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => member.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    headline: text("headline"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    gallery: jsonb("gallery").$type<string[]>().default([]),
    // Stylable profile theme (within school guidelines).
    theme: jsonb("theme").$type<Record<string, unknown>>().default({}),
    pricing: jsonb("pricing").$type<Record<string, unknown>>().default({}),
    links: jsonb("links").$type<Record<string, string>>().default({}),
    // draft | published | hidden
    status: text("status").notNull().default("draft"),
    acceptingClients: boolean("accepting_clients").notNull().default(true),
    // Self-serve claim: a single-use, expiring token lets a real graduate bind
    // their account to this seeded/invited profile (repoints member_id on claim).
    claimToken: text("claim_token").unique(),
    claimTokenExpiresAt: timestamp("claim_token_expires_at"),
    claimedAt: timestamp("claimed_at"),
    embedding: vector("embedding"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("graduate_profile_org_slug_uq").on(t.organizationId, t.slug),
    index("graduate_profile_org_idx").on(t.organizationId),
    index("graduate_profile_status_idx").on(t.status),
  ],
);

/** Practice taxonomy / "flavors". organizationId NULL = global; set = school-custom. */
export const modality = pgTable(
  "modality",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    parentId: uuid("parent_id"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
  },
  (t) => [index("modality_org_idx").on(t.organizationId)],
);

export const profileModality = pgTable(
  "profile_modality",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => graduateProfile.id, { onDelete: "cascade" }),
    modalityId: uuid("modality_id")
      .notNull()
      .references(() => modality.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
  },
  (t) => [
    uniqueIndex("profile_modality_uq").on(t.profileId, t.modalityId),
  ],
);

/** A service location (home / in-person / online) with a PostGIS point. */
export const location = pgTable(
  "location",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => graduateProfile.id, { onDelete: "cascade" }),
    label: text("label"),
    geog: geographyPoint("geog"),
    city: text("city"),
    region: text("region"),
    country: text("country"),
    serviceRadiusKm: integer("service_radius_km").default(25),
    offersOnline: boolean("offers_online").notNull().default(false),
  },
  (t) => [
    index("location_profile_idx").on(t.profileId),
    // GiST index for radius / nearest queries.
    index("location_geog_gix").using("gist", t.geog),
  ],
);

/** School-verified credential — the trust layer (agent-readable / verifiable). */
export const certification = pgTable("certification", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  profileId: uuid("profile_id")
    .notNull()
    .references(() => graduateProfile.id, { onDelete: "cascade" }),
  programName: text("program_name").notNull(),
  level: text("level"),
  credentialId: text("credential_id"),
  issuedAt: timestamp("issued_at"),
  verified: boolean("verified").notNull().default(false),
  verifiedBy: text("verified_by").references(() => member.id, {
    onDelete: "set null",
  }),
});

/** Flexible facets (languages, session format, audience…). */
export const preferenceTag = pgTable("preference_tag", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id").references(() => organization.id, {
    onDelete: "cascade",
  }),
  category: text("category").notNull(),
  label: text("label").notNull(),
});

export const profilePreference = pgTable(
  "profile_preference",
  {
    profileId: uuid("profile_id")
      .notNull()
      .references(() => graduateProfile.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => preferenceTag.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("profile_preference_uq").on(t.profileId, t.tagId)],
);

// Re-export the raw-SQL helper so query code in @directory/core stays terse.
export { sql };
