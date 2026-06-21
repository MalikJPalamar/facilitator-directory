import { embed } from "@directory/ai";
import {
  ProfileUpdate,
  type ProfileDetail,
  type ProfileStatus,
  type SchoolPublic,
} from "@directory/contracts";
import { and, asc, db, eq, sql, tables } from "@directory/db";

import { emit } from "./webhooks.ts";

export async function getSchoolBySlug(
  slug: string,
): Promise<(SchoolPublic & { id: string }) | null> {
  const [org] = await db
    .select()
    .from(tables.organization)
    .where(eq(tables.organization.slug, slug))
    .limit(1);
  if (!org) return null;
  const meta = org.metadata ?? {};
  return {
    id: org.id,
    slug: org.slug,
    name: org.name,
    logo: org.logo ?? null,
    themeColor: meta.themeColor ?? null,
    heroCopy: meta.heroCopy ?? null,
  };
}

/**
 * Hydrate a loaded `graduate_profile` row into the public `ProfileDetail` shape
 * (modalities, certifications, primary location). Shared by the public and the
 * owner-facing loaders so they can't drift.
 */
async function hydrateProfileDetail(
  p: typeof tables.graduateProfile.$inferSelect,
): Promise<ProfileDetail> {
  const modRows = (await db.execute(sql`
    select m.name from profile_modality pm
    join modality m on m.id = pm.modality_id
    where pm.profile_id = ${p.id}
  `)) as unknown as { name: string }[];

  const certRows = await db
    .select({
      programName: tables.certification.programName,
      level: tables.certification.level,
      verified: tables.certification.verified,
    })
    .from(tables.certification)
    .where(eq(tables.certification.profileId, p.id));

  const [loc] = await db
    .select({
      city: tables.location.city,
      country: tables.location.country,
      offersOnline: tables.location.offersOnline,
    })
    .from(tables.location)
    .where(eq(tables.location.profileId, p.id))
    .limit(1);

  return {
    id: p.id,
    slug: p.slug,
    displayName: p.displayName,
    headline: p.headline,
    avatarUrl: p.avatarUrl,
    modalities: modRows.map((m) => m.name),
    city: loc?.city ?? null,
    country: loc?.country ?? null,
    offersOnline: loc?.offersOnline ?? false,
    acceptingClients: p.acceptingClients,
    verified: certRows.some((c) => c.verified),
    bio: p.bio,
    gallery: p.gallery ?? [],
    pricing: p.pricing ?? {},
    links: p.links ?? {},
    certifications: certRows.map((c) => ({
      programName: c.programName,
      level: c.level,
      verified: c.verified,
    })),
  };
}

export async function getProfileDetail(
  organizationId: string,
  slug: string,
): Promise<ProfileDetail | null> {
  const [p] = await db
    .select()
    .from(tables.graduateProfile)
    .where(
      and(
        eq(tables.graduateProfile.organizationId, organizationId),
        eq(tables.graduateProfile.slug, slug),
        // Public path: never expose draft/hidden profiles by guessable slug.
        eq(tables.graduateProfile.status, "published"),
      ),
    )
    .limit(1);
  if (!p) return null;
  return hydrateProfileDetail(p);
}

/**
 * Load the OWNER's view of their profile — no published-only filter, so drafts
 * and hidden profiles stay editable. Tenant-scoped to `organizationId`; resolve
 * the profile either by its id or by the member who owns it. Carries `status`
 * so the editor can render the publish/unpublish control.
 */
export async function getOwnProfileDetail(opts: {
  organizationId: string;
  memberId?: string;
  profileId?: string;
}): Promise<(ProfileDetail & { status: ProfileStatus }) | null> {
  const { organizationId, memberId, profileId } = opts;
  if (!memberId && !profileId) return null;

  const [p] = await db
    .select()
    .from(tables.graduateProfile)
    .where(
      and(
        eq(tables.graduateProfile.organizationId, organizationId),
        profileId
          ? eq(tables.graduateProfile.id, profileId)
          : eq(tables.graduateProfile.memberId, memberId as string),
      ),
    )
    .limit(1);
  if (!p) return null;

  const detail = await hydrateProfileDetail(p);
  return { ...detail, status: p.status as ProfileStatus };
}

/** Text used to compute a profile's semantic embedding. */
export function profileEmbeddingText(parts: {
  displayName: string;
  headline?: string | null;
  bio?: string | null;
  modalities?: string[];
}): string {
  return [
    parts.displayName,
    parts.headline ?? "",
    parts.bio ?? "",
    (parts.modalities ?? []).join(" "),
  ].join(" \n ");
}

/** One graduate row for the school admin's claim-link table. */
export type SchoolGraduate = {
  id: string;
  slug: string;
  displayName: string;
  status: string;
  claimed: boolean;
};

/**
 * List every graduate profile in a school for the admin claim-link UI, ordered
 * by display name. `claimed` is true once a real graduate has bound their
 * account (`claimed_at` set) — the UI only offers an emit-link button for the
 * still-unclaimed rows. Tenant-scoped to `organizationId`.
 */
export async function listSchoolGraduates(
  organizationId: string,
): Promise<SchoolGraduate[]> {
  const rows = await db
    .select({
      id: tables.graduateProfile.id,
      slug: tables.graduateProfile.slug,
      displayName: tables.graduateProfile.displayName,
      status: tables.graduateProfile.status,
      claimedAt: tables.graduateProfile.claimedAt,
    })
    .from(tables.graduateProfile)
    .where(eq(tables.graduateProfile.organizationId, organizationId))
    .orderBy(asc(tables.graduateProfile.displayName));

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    displayName: r.displayName,
    status: r.status,
    claimed: r.claimedAt != null,
  }));
}

export async function updateProfile(
  organizationId: string,
  profileId: string,
  patchInput: ProfileUpdate,
): Promise<void> {
  // Defense in depth: re-validate the patch at the trust boundary even if the
  // caller already validated. Throws on bad shape (e.g. a non-URL website).
  const patch = ProfileUpdate.parse(patchInput);

  // Recompute the embedding when text fields change so semantic search stays fresh.
  const [existing] = await db
    .select()
    .from(tables.graduateProfile)
    .where(
      and(
        eq(tables.graduateProfile.id, profileId),
        eq(tables.graduateProfile.organizationId, organizationId),
      ),
    )
    .limit(1);
  if (!existing) throw new Error("profile not found");

  const modRows = (await db.execute(sql`
    select m.name from profile_modality pm
    join modality m on m.id = pm.modality_id
    where pm.profile_id = ${profileId}
  `)) as unknown as { name: string }[];

  const embedding = embed(
    profileEmbeddingText({
      displayName: existing.displayName,
      headline: patch.headline ?? existing.headline,
      bio: patch.bio ?? existing.bio,
      modalities: modRows.map((m) => m.name),
    }),
  );

  const wasPublished = existing.status === "published";
  const newStatus = patch.status ?? existing.status;

  await db
    .update(tables.graduateProfile)
    .set({
      headline: patch.headline ?? existing.headline,
      bio: patch.bio ?? existing.bio,
      pricing: patch.pricing ?? existing.pricing,
      links: patch.links ?? existing.links,
      acceptingClients: patch.acceptingClients ?? existing.acceptingClients,
      theme: patch.theme ?? existing.theme,
      status: newStatus,
      embedding,
      updatedAt: new Date(),
    })
    .where(eq(tables.graduateProfile.id, profileId));

  // Outbound webhooks (best-effort): every edit emits profile.updated; the
  // draft/hidden -> published transition additionally emits profile.published.
  // updateProfile is the single write path for status, so this is authoritative.
  void emit({ organizationId, type: "profile.updated", data: { profileId } });
  if (!wasPublished && newStatus === "published") {
    void emit({
      organizationId,
      type: "profile.published",
      data: { profileId, slug: existing.slug },
    });
  }
}

/**
 * Resolve a profile by slug for an authenticated WRITE (any status, so drafts
 * and hidden profiles are reachable by an admin/agent editor). Tenant-scoped.
 */
export async function getProfileForWrite(
  organizationId: string,
  slug: string,
): Promise<{ id: string; status: ProfileStatus } | null> {
  const [p] = await db
    .select({
      id: tables.graduateProfile.id,
      status: tables.graduateProfile.status,
    })
    .from(tables.graduateProfile)
    .where(
      and(
        eq(tables.graduateProfile.organizationId, organizationId),
        eq(tables.graduateProfile.slug, slug),
      ),
    )
    .limit(1);
  if (!p) return null;
  return { id: p.id, status: p.status as ProfileStatus };
}
