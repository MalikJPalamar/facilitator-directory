import { db, eq, tables } from "@directory/db";

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
