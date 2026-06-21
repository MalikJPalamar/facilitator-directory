import { randomUUID } from "node:crypto";

import {
  ClaimError,
  claimProfile,
  getOwnProfileDetail,
  getProfileDetail,
  getSchoolBySlug,
  issueClaimToken,
  latestInsightDTO,
  listSchoolGraduates,
  runNightly,
  updateProfile,
} from "@directory/core";
import { and, db, eq, inArray, queryClient, tables } from "@directory/db";

/**
 * End-to-end USER-JOURNEY TEST KIT — operator/admin, School X, Facilitator X.
 *
 * Exercises the M3 prototype against a real database using the same domain
 * functions the app does: create a school, an unclaimed facilitator profile,
 * emit a claim link, claim it as a new user, edit + publish, verify public
 * visibility, prove the claim security guards, and run the nightly LEARN loop.
 *
 * SAFE BY DEFAULT: refuses to run unless DATABASE_URL is a local DB (override
 * with JOURNEY_ALLOW_REMOTE=1). It creates an isolated "School X" tenant and
 * deletes it (cascade) on the way out, so it leaves no residue.
 *
 * Run:  ANTHROPIC_API_KEY= DATABASE_URL=postgres://directory:directory@localhost:5432/directory \
 *         pnpm --filter @directory/worker journey
 */

const url = process.env.DATABASE_URL ?? "";
const isLocal = /@(localhost|127\.0\.0\.1)([:/]|$)/.test(url);
if (!isLocal && process.env.JOURNEY_ALLOW_REMOTE !== "1") {
  console.error(
    "✗ Refusing to run: DATABASE_URL is not local.\n" +
      "  Point it at a local/test DB, or set JOURNEY_ALLOW_REMOTE=1 to override.",
  );
  process.exit(2);
}

let pass = 0;
let fail = 0;
const lines: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) {
    pass++;
    lines.push(`  ✓ ${name}`);
  } else {
    fail++;
    lines.push(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const SFX = randomUUID().slice(0, 8);
const ORG_ID = `org_school_x_${SFX}`;
const SCHOOL_SLUG = `school-x-${SFX}`;
const FAC_SLUG = `facilitator-x-${SFX}`;
const createdUserIds: string[] = [];

async function setup(): Promise<{ profileId: string }> {
  // ── School X + its operator (owner) ──
  await db.insert(tables.organization).values({
    id: ORG_ID,
    name: "School X",
    slug: SCHOOL_SLUG,
    metadata: { themeColor: "#3B7A8C", heroCopy: "School X — journey test tenant" },
  });

  const ownerUserId = randomUUID();
  createdUserIds.push(ownerUserId);
  await db.insert(tables.user).values({
    id: ownerUserId,
    name: "Operator X",
    email: `operator-x-${SFX}@example.test`,
    emailVerified: true,
  });
  await db.insert(tables.member).values({
    id: randomUUID(),
    organizationId: ORG_ID,
    userId: ownerUserId,
    role: "owner",
  });
  // The default subscription mirror the onboarding hook creates for a new org.
  await db
    .insert(tables.subscription)
    .values({ organizationId: ORG_ID, status: "none", seats: 1 });

  // ── Facilitator X — an UNCLAIMED profile (placeholder member, like a seeded/invited grad) ──
  const placeholderUserId = randomUUID();
  createdUserIds.push(placeholderUserId);
  await db.insert(tables.user).values({
    id: placeholderUserId,
    name: "Facilitator X (placeholder)",
    email: `facilitator-x-seed-${SFX}@example.test`,
    emailVerified: true,
  });
  const placeholderMemberId = randomUUID();
  await db.insert(tables.member).values({
    id: placeholderMemberId,
    organizationId: ORG_ID,
    userId: placeholderUserId,
    role: "graduate",
  });
  const [prof] = await db
    .insert(tables.graduateProfile)
    .values({
      organizationId: ORG_ID,
      memberId: placeholderMemberId,
      slug: FAC_SLUG,
      displayName: "Facilitator X",
      headline: "Breathwork facilitator (unclaimed)",
      bio: "Placeholder bio, pre-claim.",
      status: "draft",
      acceptingClients: true,
      gallery: [],
    })
    .returning({ id: tables.graduateProfile.id });
  return { profileId: prof!.id };
}

async function teardown(): Promise<void> {
  // Deleting the org cascades members, profiles, subscription, insights, etc.
  await db.delete(tables.organization).where(eq(tables.organization.id, ORG_ID));
  if (createdUserIds.length > 0) {
    await db.delete(tables.user).where(inArray(tables.user.id, createdUserIds));
  }
}

async function main(): Promise<boolean> {
  const { profileId } = await setup();

  // ════ OPERATOR / ADMIN ════
  const school = await getSchoolBySlug(SCHOOL_SLUG);
  check("School X resolves by slug", !!school && school.id === ORG_ID);

  const grads = await listSchoolGraduates(ORG_ID);
  const facRow = grads.find((g) => g.id === profileId);
  check(
    "Admin sees Facilitator X as UNCLAIMED",
    !!facRow && facRow.claimed === false,
    facRow ? `claimed=${facRow.claimed}` : "not listed",
  );

  const [subRow] = await db
    .select()
    .from(tables.subscription)
    .where(eq(tables.subscription.organizationId, ORG_ID))
    .limit(1);
  check("Default subscription mirror exists (status=none)", subRow?.status === "none");

  const token = await issueClaimToken(profileId);
  check("Operator emits a claim token", typeof token === "string" && token.length > 20);

  // ════ FACILITATOR X — claims, edits, publishes ════
  const facUserId = randomUUID();
  createdUserIds.push(facUserId);
  await db.insert(tables.user).values({
    id: facUserId,
    name: "Facilitator X",
    email: `facilitator-x-real-${SFX}@example.test`,
    emailVerified: true,
  });

  const claimedSlug = await claimProfile({ token, userId: facUserId });
  check("Facilitator X claims the profile", claimedSlug === FAC_SLUG);

  const [profClaimed] = await db
    .select()
    .from(tables.graduateProfile)
    .where(eq(tables.graduateProfile.id, profileId))
    .limit(1);
  const [facMember] = await db
    .select()
    .from(tables.member)
    .where(
      and(eq(tables.member.userId, facUserId), eq(tables.member.organizationId, ORG_ID)),
    )
    .limit(1);
  check("member_id repointed to the claiming user", profClaimed?.memberId === facMember?.id);
  check("claim token burned (single-use)", profClaimed?.claimToken === null);
  check("claimed_at stamped", profClaimed?.claimedAt != null);

  // ════ SECURITY GUARDS ════
  let reclaimRejected = false;
  try {
    await claimProfile({ token, userId: randomUUID() });
  } catch (e) {
    reclaimRejected = e instanceof ClaimError;
  }
  check("Re-claim with the burned token is rejected", reclaimRejected);

  let reissueRejected = false;
  try {
    await issueClaimToken(profileId);
  } catch (e) {
    reissueRejected = e instanceof ClaimError;
  }
  check("Re-issuing a token on a claimed profile is refused (no takeover)", reissueRejected);

  // ════ EDIT + PUBLISH ════
  const ownDraft = await getOwnProfileDetail({
    organizationId: ORG_ID,
    memberId: facMember!.id,
  });
  check("Owner loads their DRAFT profile (no published filter)", ownDraft?.status === "draft");

  await updateProfile(ORG_ID, profileId, {
    headline: "Trauma-informed breathwork for burnout",
    bio: "Gentle 1:1 and group breathwork sessions. (edited in journey test)",
    links: { website: "https://facilitator-x.example" },
    status: "published",
  });
  const [profPub] = await db
    .select()
    .from(tables.graduateProfile)
    .where(eq(tables.graduateProfile.id, profileId))
    .limit(1);
  check("Edit persisted (headline updated)", profPub?.headline?.includes("burnout") ?? false);
  check("Publish persisted (status=published)", profPub?.status === "published");

  // ════ SERVER-SIDE VALIDATION ════
  let badUrlRejected = false;
  try {
    await updateProfile(ORG_ID, profileId, { links: { website: "not-a-url" } });
  } catch {
    badUrlRejected = true;
  }
  check("Server-side validation rejects a bad website URL", badUrlRejected);

  // ════ PUBLIC DIRECTORY ════
  const pub = await getProfileDetail(ORG_ID, FAC_SLUG);
  check(
    "Published profile is visible on the public directory",
    !!pub && (pub.headline?.includes("burnout") ?? false),
  );

  // ════ NIGHTLY LEARN LOOP ════
  const evalBefore = (await db.select().from(tables.evalRun)).length;
  await runNightly();
  const evalAfter = (await db.select().from(tables.evalRun)).length;
  check("Nightly loop persists an eval_run row", evalAfter > evalBefore);
  const schoolInsight = await latestInsightDTO(ORG_ID, "school", null);
  check("Nightly generated a school insight for School X", !!schoolInsight);

  console.log("\n── User-journey results (operator/admin · School X · Facilitator X) ──");
  console.log(lines.join("\n"));
  console.log(
    `\n${fail === 0 ? "✓ ALL PASS" : "✗ FAILURES"} — ${pass} passed, ${fail} failed.`,
  );
  return fail === 0;
}

main()
  .then(async (ok) => {
    await teardown();
    await queryClient.end();
    process.exit(ok ? 0 : 1);
  })
  .catch(async (err) => {
    console.error("\njourney crashed:", err);
    try {
      await teardown();
    } catch {
      /* best effort */
    }
    await queryClient.end().catch(() => {});
    process.exit(1);
  });
