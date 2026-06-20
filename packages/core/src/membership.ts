import { and, db, eq, tables } from "@directory/db";

/**
 * Resolve who a logged-in user IS within the tenant model: their membership
 * (which school + role) and, for graduates, their public profile. The auth
 * session gives a userId; these turn it into the `organizationId` + `role` every
 * tenant-scoped query needs, and the `graduate_profile` a graduate's own
 * dashboard renders.
 */

export type Membership = {
  memberId: string;
  organizationId: string;
  role: string;
};

/**
 * The user's membership in a specific org, or — when `organizationId` is
 * omitted — their first membership. (Most users belong to exactly one school in
 * this phase; the active-org claim refines this once multi-school users exist.)
 */
export async function membershipForUser(
  userId: string,
  organizationId?: string,
): Promise<Membership | null> {
  const where = organizationId
    ? and(eq(tables.member.userId, userId), eq(tables.member.organizationId, organizationId))
    : eq(tables.member.userId, userId);

  const [row] = await db
    .select({
      memberId: tables.member.id,
      organizationId: tables.member.organizationId,
      role: tables.member.role,
    })
    .from(tables.member)
    .where(where)
    .limit(1);

  return row ?? null;
}

/** The graduate profile owned by a member, if any (id + slug for linking). */
export async function graduateProfileForMember(
  memberId: string,
): Promise<{ id: string; slug: string } | null> {
  const [row] = await db
    .select({ id: tables.graduateProfile.id, slug: tables.graduateProfile.slug })
    .from(tables.graduateProfile)
    .where(eq(tables.graduateProfile.memberId, memberId))
    .limit(1);

  return row ?? null;
}
