import { db, desc, eq, sql, tables } from "@directory/db";

/** A platform-wide school summary row for the read-only superadmin overview. */
export type SchoolSummary = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  memberCount: number;
  graduateCount: number;
  subscriptionStatus: string;
};

/**
 * Every school on the platform with basic counts — for the read-only superadmin
 * overview only. Cross-tenant by design (it is NOT scoped to one org), so it
 * must only ever be called behind the SUPERADMIN_EMAILS allow-list. Counts are
 * computed with correlated sub-selects to keep this a single round-trip.
 */
export async function listAllSchools(): Promise<SchoolSummary[]> {
  // Base list of schools + their subscription status (LEFT JOIN: subscription is
  // 1:1 with org via the unique organization_id, so this can't fan out rows).
  const base = await db
    .select({
      id: tables.organization.id,
      name: tables.organization.name,
      slug: tables.organization.slug,
      createdAt: tables.organization.createdAt,
      subscriptionStatus: tables.subscription.status,
    })
    .from(tables.organization)
    .leftJoin(
      tables.subscription,
      eq(tables.subscription.organizationId, tables.organization.id),
    )
    .orderBy(desc(tables.organization.createdAt));

  // Counts are grouped separately (rather than joined together) so member and
  // graduate joins can't multiply each other into inflated counts.
  const memberCounts = await db
    .select({
      organizationId: tables.member.organizationId,
      count: sql<number>`count(*)::int`,
    })
    .from(tables.member)
    .groupBy(tables.member.organizationId);
  const gradCounts = await db
    .select({
      organizationId: tables.graduateProfile.organizationId,
      count: sql<number>`count(*)::int`,
    })
    .from(tables.graduateProfile)
    .groupBy(tables.graduateProfile.organizationId);

  const memberBy = new Map(memberCounts.map((r) => [r.organizationId, Number(r.count)]));
  const gradBy = new Map(gradCounts.map((r) => [r.organizationId, Number(r.count)]));

  return base.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    createdAt: r.createdAt,
    memberCount: memberBy.get(r.id) ?? 0,
    graduateCount: gradBy.get(r.id) ?? 0,
    subscriptionStatus: r.subscriptionStatus ?? "none",
  }));
}

/** The branding fields an owner/admin can edit for their school. */
export type OrgBranding = {
  name: string;
  logo: string | null;
  themeColor: string | null;
  heroCopy: string | null;
};

/**
 * Load a school's editable branding. `themeColor`/`heroCopy` live in the org's
 * JSON `metadata`; they're surfaced as `null` when absent so the editor renders
 * empty inputs rather than the string "undefined".
 */
export async function getOrganizationBranding(
  organizationId: string,
): Promise<OrgBranding | null> {
  const [org] = await db
    .select()
    .from(tables.organization)
    .where(eq(tables.organization.id, organizationId))
    .limit(1);
  if (!org) return null;
  const meta = org.metadata ?? {};
  return {
    name: org.name,
    logo: org.logo ?? null,
    themeColor: meta.themeColor ?? null,
    heroCopy: meta.heroCopy ?? null,
  };
}

/**
 * Update a school's branding. `name`/`logo` are top-level columns;
 * `themeColor`/`heroCopy` are merged into `metadata` so the other metadata
 * fields (`customDomain`, `brandGuidelines`) survive the write. All strings are
 * trimmed and length-capped; an out-of-range or empty `name` keeps the existing
 * value, and an empty `logo` clears it to null.
 */
export async function updateOrganizationBranding(
  organizationId: string,
  patch: {
    name?: string;
    logo?: string | null;
    themeColor?: string;
    heroCopy?: string;
  },
): Promise<void> {
  const [existing] = await db
    .select()
    .from(tables.organization)
    .where(eq(tables.organization.id, organizationId))
    .limit(1);
  if (!existing) throw new Error("organization not found");

  let name = existing.name;
  if (patch.name !== undefined) {
    const trimmed = patch.name.trim();
    if (trimmed.length > 0 && trimmed.length <= 120) name = trimmed;
  }

  let logo = existing.logo ?? null;
  if (patch.logo !== undefined) {
    if (patch.logo === null) {
      logo = null;
    } else {
      const trimmed = patch.logo.trim();
      logo = trimmed.length > 0 ? trimmed : null;
    }
  }

  const meta = { ...(existing.metadata ?? {}) };
  if (patch.themeColor !== undefined) {
    meta.themeColor = patch.themeColor.trim().slice(0, 32);
  }
  if (patch.heroCopy !== undefined) {
    meta.heroCopy = patch.heroCopy.trim().slice(0, 240);
  }

  await db
    .update(tables.organization)
    .set({ name, logo, metadata: meta })
    .where(eq(tables.organization.id, organizationId));
}
