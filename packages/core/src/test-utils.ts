import { randomUUID } from "node:crypto";

import { db, eq, inArray, queryClient, tables } from "@directory/db";

/**
 * Shared helpers + safety guard for DB-touching tests. They run against the
 * LOCAL docker `directory-postgres` (postgres://directory:directory@localhost:5432).
 * Each test namespaces its data with a random suffix and tears it down, since
 * Vitest runs files in parallel and they share one database.
 */

const url = process.env.DATABASE_URL ?? "";
export const HAS_DB = !!process.env.DATABASE_URL;
export const IS_LOCAL_DB = /@(localhost|127\.0\.0\.1)([:/]|$)/.test(url);

/** Throw unless DATABASE_URL is local — never let DB tests touch a remote DB. */
export function requireLocalDb(): void {
  if (!IS_LOCAL_DB) {
    throw new Error(
      "DB tests require a LOCAL DATABASE_URL (localhost/127.0.0.1). Run `pnpm infra:up && pnpm db:migrate`.",
    );
  }
}

export type SeededOrg = { orgId: string; slug: string; userIds: string[] };

export async function seedOrg(label = "test"): Promise<SeededOrg> {
  const sfx = randomUUID().slice(0, 8);
  const orgId = `org_${label}_${sfx}`;
  const slug = `${label}-${sfx}`;
  const ownerId = randomUUID();
  await db.insert(tables.organization).values({
    id: orgId,
    name: `Org ${sfx}`,
    slug,
    metadata: { themeColor: "#3B7A8C", heroCopy: "test tenant" },
  });
  await db.insert(tables.user).values({
    id: ownerId,
    name: "Owner",
    email: `owner-${sfx}@example.test`,
    emailVerified: true,
  });
  await db.insert(tables.member).values({
    id: randomUUID(),
    organizationId: orgId,
    userId: ownerId,
    role: "owner",
  });
  await db
    .insert(tables.subscription)
    .values({ organizationId: orgId, status: "none", seats: 1 })
    .onConflictDoNothing({ target: tables.subscription.organizationId });
  return { orgId, slug, userIds: [ownerId] };
}

export async function teardownOrg(o: SeededOrg): Promise<void> {
  await db.delete(tables.organization).where(eq(tables.organization.id, o.orgId)); // cascades
  if (o.userIds.length)
    await db.delete(tables.user).where(inArray(tables.user.id, o.userIds));
}

export async function closeDb(): Promise<void> {
  await queryClient.end().catch(() => {});
}
