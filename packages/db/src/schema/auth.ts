import {
  boolean,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Better Auth core + plugin tables.
 *
 * These match the schema Better Auth's Drizzle adapter expects (core auth +
 * Organization plugin + OAuth 2.1 Provider plugin). Better Auth is pointed at
 * these tables, so the whole system has a single Drizzle source of truth and a
 * single Postgres migration history.
 *
 * `organization` == a SCHOOL (tenant). `member` is the multi-tenant pivot and
 * the unit billing counts (one seat per graduate member).
 */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // Set by the Organization plugin — the "current school" for this session.
  activeOrganizationId: text("active_organization_id"),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** A SCHOOL — the tenant. `slug` is the public directory key; `metadata` holds branding. */
export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: jsonb("metadata").$type<OrganizationMetadata>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type OrganizationMetadata = {
  themeColor?: string;
  heroCopy?: string;
  customDomain?: string;
  /** Free-form brand guidelines the AI uses when reviewing/coaching profiles. */
  brandGuidelines?: string;
};

/** Membership join: a user's role within one school. The multi-tenant pivot + billing seat. */
export const member = pgTable("member", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // owner | admin | graduate
  role: text("role").notNull().default("graduate"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const invitation = pgTable("invitation", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull().default("graduate"),
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  inviterId: text("inviter_id").references(() => user.id, {
    onDelete: "set null",
  }),
});

// ── OAuth 2.1 Provider plugin (makes Better Auth the MCP authorization server) ──

export const oauthApplication = pgTable("oauth_application", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  clientId: text("client_id").notNull().unique(),
  clientSecret: text("client_secret"),
  redirectURLs: text("redirect_urls"),
  metadata: text("metadata"),
  type: text("type"),
  disabled: boolean("disabled").default(false),
  userId: text("user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const oauthAccessToken = pgTable("oauth_access_token", {
  id: text("id").primaryKey(),
  accessToken: text("access_token").notNull().unique(),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  clientId: text("client_id"),
  userId: text("user_id"),
  scopes: text("scopes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const oauthConsent = pgTable("oauth_consent", {
  id: text("id").primaryKey(),
  clientId: text("client_id"),
  userId: text("user_id"),
  scopes: text("scopes"),
  consentGiven: boolean("consent_given").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
