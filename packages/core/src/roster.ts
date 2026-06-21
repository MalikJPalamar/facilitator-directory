import { randomUUID } from "node:crypto";

import { embed } from "@directory/ai";
import type { RosterImport, RosterImportResult } from "@directory/contracts";
import { and, db, eq, sql, tables } from "@directory/db";

import { issueClaimToken } from "./claim.ts";
import { profileEmbeddingText } from "./profiles.ts";

/**
 * Bulk roster upsert over HTTP — the provision-school CLI's facilitator import
 * (steps 3+4) made callable by an admin-scoped agent/CRM. Scoped to an EXISTING
 * org (never creates one). Idempotent: existing-but-unclaimed profiles are
 * updated, already-claimed profiles are skipped, new ones are created as
 * unclaimed drafts with a synthetic placeholder account. Claim links are minted
 * only when `issueClaimLinks` is set. Never sends email (the API caller decides).
 */

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "x"
  );
}

export async function importRoster(
  organizationId: string,
  input: RosterImport,
  opts: { baseUrl?: string } = {},
): Promise<RosterImportResult> {
  const result: RosterImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    profiles: [],
  };

  // Org-scoped modality cache for this run.
  const modalityIds = new Map<string, string>();
  async function ensureModality(name: string): Promise<string> {
    const cached = modalityIds.get(name);
    if (cached) return cached;
    const slug = slugify(name);
    const [ex] = await db
      .select({ id: tables.modality.id })
      .from(tables.modality)
      .where(
        and(
          eq(tables.modality.organizationId, organizationId),
          eq(tables.modality.slug, slug),
        ),
      )
      .limit(1);
    let id = ex?.id;
    if (!id) {
      id = randomUUID();
      await db
        .insert(tables.modality)
        .values({ id, organizationId, name, slug });
    }
    modalityIds.set(name, id);
    return id;
  }

  for (const f of input.facilitators) {
    const [existing] = await db
      .select()
      .from(tables.graduateProfile)
      .where(
        and(
          eq(tables.graduateProfile.organizationId, organizationId),
          eq(tables.graduateProfile.slug, f.slug),
        ),
      )
      .limit(1);

    if (existing?.claimedAt) {
      result.skipped++;
      result.profiles.push({ slug: f.slug, id: existing.id, status: "claimed" });
      continue;
    }

    const embedding = embed(
      profileEmbeddingText({
        displayName: f.displayName,
        headline: f.headline,
        bio: f.bio,
        modalities: f.modalities,
      }),
    );

    let profileId: string;
    if (existing) {
      await db
        .update(tables.graduateProfile)
        .set({
          displayName: f.displayName,
          headline: f.headline ?? existing.headline,
          bio: f.bio ?? existing.bio,
          embedding,
          updatedAt: new Date(),
        })
        .where(eq(tables.graduateProfile.id, existing.id));
      profileId = existing.id;
      result.updated++;
    } else {
      // Synthetic placeholder account so the real facilitator can sign up with
      // their own email and claim — their real email is never stored as a login.
      const placeholderUserId = randomUUID();
      const memberId = randomUUID();
      await db.insert(tables.user).values({
        id: placeholderUserId,
        name: f.displayName,
        email: `${f.slug}+seed-${randomUUID().slice(0, 8)}@${organizationId}.invalid`,
        emailVerified: true,
      });
      await db.insert(tables.member).values({
        id: memberId,
        organizationId,
        userId: placeholderUserId,
        role: "graduate",
      });
      const [p] = await db
        .insert(tables.graduateProfile)
        .values({
          organizationId,
          memberId,
          slug: f.slug,
          displayName: f.displayName,
          headline: f.headline ?? null,
          bio: f.bio ?? null,
          status: "draft",
          acceptingClients: true,
          gallery: [],
          embedding,
        })
        .returning({ id: tables.graduateProfile.id });
      profileId = p!.id;
      result.created++;

      for (const [i, mName] of (f.modalities ?? []).entries()) {
        const mid = await ensureModality(mName);
        await db
          .insert(tables.profileModality)
          .values({ profileId, modalityId: mid, isPrimary: i === 0 })
          .onConflictDoNothing();
      }
      if (f.lat != null && f.lng != null) {
        await db.execute(sql`
          insert into location (organization_id, profile_id, label, geog, city, region, country, service_radius_km, offers_online)
          values (${organizationId}, ${profileId}, 'primary',
            ST_SetSRID(ST_MakePoint(${f.lng}, ${f.lat}), 4326)::geography,
            ${f.city ?? null}, null, ${f.country ?? null}, 50, ${f.online ?? false})`);
      }
      if (f.program) {
        await db.insert(tables.certification).values({
          organizationId,
          profileId,
          programName: f.program,
          level: "Certified",
          verified: true,
        });
      }
    }

    let claimUrl: string | undefined;
    if (input.issueClaimLinks) {
      try {
        const token = await issueClaimToken(profileId);
        claimUrl = opts.baseUrl ? `${opts.baseUrl}/claim/${token}` : token;
      } catch {
        // Already claimed between read and now — leave claimUrl unset.
      }
    }

    result.profiles.push({
      slug: f.slug,
      id: profileId,
      status: existing ? "updated" : "created",
      ...(claimUrl ? { claimUrl } : {}),
    });
  }

  return result;
}
