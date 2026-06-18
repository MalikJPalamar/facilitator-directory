import { embed } from "@directory/ai";
import type {
  ProfileDetail,
  ProfileUpdate,
  SchoolPublic,
} from "@directory/contracts";
import { and, db, eq, sql, tables } from "@directory/db";

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
      ),
    )
    .limit(1);
  if (!p) return null;

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

export async function updateProfile(
  organizationId: string,
  profileId: string,
  patch: ProfileUpdate,
): Promise<void> {
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

  await db
    .update(tables.graduateProfile)
    .set({
      headline: patch.headline ?? existing.headline,
      bio: patch.bio ?? existing.bio,
      pricing: patch.pricing ?? existing.pricing,
      links: patch.links ?? existing.links,
      acceptingClients: patch.acceptingClients ?? existing.acceptingClients,
      theme: patch.theme ?? existing.theme,
      embedding,
      updatedAt: new Date(),
    })
    .where(eq(tables.graduateProfile.id, profileId));
}
