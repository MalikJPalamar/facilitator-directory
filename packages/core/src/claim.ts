import { randomBytes, randomUUID } from "node:crypto";

import { and, db, eq, isNull, tables } from "@directory/db";

import { emit } from "./webhooks.ts";

/**
 * Self-serve profile claim. A school seeds/invites a `graduate_profile` and
 * hands the real graduate a single-use claim link. Claiming binds the graduate's
 * signed-in account (a `member` row in the profile's org) to that profile.
 *
 * All operations are tenant-scoped to the profile's own `organizationId`.
 */

/** Claim tokens live for 14 days from issue. */
const CLAIM_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Mint a fresh claim token for a profile and stamp its 14-day expiry. Returns
 * the raw token; the caller (admin UI / seed) is responsible for turning it into
 * a `/claim/<token>` link and delivering it. Building that admin emit-UI is out
 * of scope for this wave.
 */
export async function issueClaimToken(profileId: string): Promise<string> {
  const token = `${randomUUID()}${randomBytes(16).toString("hex")}`;
  const expiresAt = new Date(Date.now() + CLAIM_TTL_MS);

  // Only arm a token on an UNCLAIMED profile — never re-issue a link for a
  // profile a real graduate already owns (re-arming would enable takeover).
  const armed = await db
    .update(tables.graduateProfile)
    .set({ claimToken: token, claimTokenExpiresAt: expiresAt })
    .where(
      and(
        eq(tables.graduateProfile.id, profileId),
        isNull(tables.graduateProfile.claimedAt),
      ),
    )
    .returning({ id: tables.graduateProfile.id });

  if (armed.length === 0) {
    throw new ClaimError(
      "This profile cannot be claimed (already claimed or not found).",
    );
  }
  return token;
}

export type ClaimablePreview = {
  profileId: string;
  organizationId: string;
  slug: string;
  displayName: string;
};

/**
 * Resolve a claim token to a preview of the profile it unlocks — or null when
 * the token is unknown or expired. Used by the claim page to show the graduate
 * what they're about to claim before they commit.
 */
export async function previewClaim(token: string): Promise<ClaimablePreview | null> {
  if (!token) return null;
  const [p] = await db
    .select({
      profileId: tables.graduateProfile.id,
      organizationId: tables.graduateProfile.organizationId,
      slug: tables.graduateProfile.slug,
      displayName: tables.graduateProfile.displayName,
      expiresAt: tables.graduateProfile.claimTokenExpiresAt,
    })
    .from(tables.graduateProfile)
    .where(eq(tables.graduateProfile.claimToken, token))
    .limit(1);

  if (!p) return null;
  if (!p.expiresAt || p.expiresAt.getTime() < Date.now()) return null;

  return {
    profileId: p.profileId,
    organizationId: p.organizationId,
    slug: p.slug,
    displayName: p.displayName,
  };
}

export class ClaimError extends Error {}

/**
 * Bind the signed-in user to the profile a claim token unlocks. Reuses the
 * user's existing membership in the profile's org, or creates a "graduate" one,
 * then repoints the profile's `member_id`, clears the token, and stamps
 * `claimed_at`. Returns the claimed profile's slug. Throws `ClaimError` on an
 * unknown or expired token.
 */
export async function claimProfile(opts: {
  token: string;
  userId: string;
}): Promise<string> {
  const { token, userId } = opts;

  const preview = await previewClaim(token);
  if (!preview) throw new ClaimError("This claim link is invalid or has expired.");

  // One transaction so a race-loser (or a re-claim attempt) leaves no orphan
  // member: if the compare-and-set burn matches zero rows we throw, which rolls
  // back any membership inserted above.
  const slug = await db.transaction(async (tx) => {
    // Reuse an existing (userId, orgId) membership, else create one.
    const [existingMember] = await tx
      .select({ id: tables.member.id })
      .from(tables.member)
      .where(
        and(
          eq(tables.member.userId, userId),
          eq(tables.member.organizationId, preview.organizationId),
        ),
      )
      .limit(1);

    let memberId = existingMember?.id;
    if (!memberId) {
      memberId = randomUUID();
      await tx.insert(tables.member).values({
        id: memberId,
        organizationId: preview.organizationId,
        userId,
        role: "graduate",
      });
    }

    // Compare-and-set: repoint + burn the token ONLY while it is still the live
    // token AND the profile is still unclaimed (claimed_at IS NULL), re-scoped to
    // the profile's org. A second concurrent claim, a re-used token, or a
    // re-claim of an already-owned profile all match zero rows -> ClaimError.
    const claimed = await tx
      .update(tables.graduateProfile)
      .set({
        memberId,
        claimToken: null,
        claimTokenExpiresAt: null,
        claimedAt: new Date(),
      })
      .where(
        and(
          eq(tables.graduateProfile.id, preview.profileId),
          eq(tables.graduateProfile.organizationId, preview.organizationId),
          eq(tables.graduateProfile.claimToken, token),
          isNull(tables.graduateProfile.claimedAt),
        ),
      )
      .returning({ id: tables.graduateProfile.id });

    if (claimed.length === 0) {
      throw new ClaimError("This claim link is invalid or has expired.");
    }

    return preview.slug;
  });

  // Notify the school's CRM that a graduate claimed their profile (best-effort).
  void emit({
    organizationId: preview.organizationId,
    type: "profile.claimed",
    data: { profileId: preview.profileId, slug: preview.slug },
  });
  return slug;
}
