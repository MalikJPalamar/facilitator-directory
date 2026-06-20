import { randomUUID } from "node:crypto";

import { and, db, eq, tables } from "@directory/db";

import { auth } from "../src/index.ts";

/**
 * Creates demo LOGIN accounts (email + password) for the seeded
 * "Global Breathwork Collective" org, so the auth flow is demoable end-to-end.
 * The base `db:seed` makes passwordless users; this adds credentialed ones via
 * Better Auth (which hashes the password into the `account` table) and wires
 * their membership. Idempotent: re-running reuses existing users.
 *
 * Run AFTER `pnpm db:seed`:  pnpm --filter @directory/auth seed:demo
 */

const ORG_ID = "org_breathwork_global";

const OWNER = {
  email: "demo-owner@breathwork.example",
  password: "breathwork-demo-owner",
  name: "Demo Owner",
  role: "owner",
};
const GRAD = {
  email: "demo-grad@breathwork.example",
  password: "breathwork-demo-grad",
  name: "Demo Graduate (Maya)",
  role: "graduate",
};

async function ensureUser(u: { email: string; password: string; name: string }): Promise<string> {
  const existing = await db
    .select({ id: tables.user.id })
    .from(tables.user)
    .where(eq(tables.user.email, u.email))
    .limit(1);
  if (existing[0]) {
    console.log(`  · user exists: ${u.email}`);
    return existing[0].id;
  }
  await auth.api.signUpEmail({
    body: { email: u.email, password: u.password, name: u.name },
  });
  const [created] = await db
    .select({ id: tables.user.id })
    .from(tables.user)
    .where(eq(tables.user.email, u.email))
    .limit(1);
  if (!created) throw new Error(`failed to create user ${u.email}`);
  console.log(`  ✓ created user: ${u.email}`);
  return created.id;
}

async function ensureMember(userId: string, role: string): Promise<string> {
  const existing = await db
    .select({ id: tables.member.id })
    .from(tables.member)
    .where(and(eq(tables.member.userId, userId), eq(tables.member.organizationId, ORG_ID)))
    .limit(1);
  if (existing[0]) return existing[0].id;
  const id = randomUUID();
  await db.insert(tables.member).values({ id, organizationId: ORG_ID, userId, role });
  return id;
}

async function main() {
  console.log("→ demo owner…");
  const ownerId = await ensureUser(OWNER);
  await ensureMember(ownerId, OWNER.role);

  console.log("→ demo graduate (linked to Maya's profile)…");
  const gradId = await ensureUser(GRAD);
  const gradMemberId = await ensureMember(gradId, GRAD.role);

  // Point Maya's published profile at the credentialed graduate so /me has data.
  const updated = await db
    .update(tables.graduateProfile)
    .set({ memberId: gradMemberId })
    .where(
      and(
        eq(tables.graduateProfile.organizationId, ORG_ID),
        eq(tables.graduateProfile.slug, "maya-okonkwo"),
      ),
    )
    .returning({ id: tables.graduateProfile.id });
  console.log(updated[0] ? "  ✓ linked maya-okonkwo → demo graduate" : "  ! maya-okonkwo profile not found (run db:seed first)");

  console.log("\n✓ demo logins ready:");
  console.log(`   owner    ${OWNER.email} / ${OWNER.password}  → /admin`);
  console.log(`   graduate ${GRAD.email} / ${GRAD.password}  → /me`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
