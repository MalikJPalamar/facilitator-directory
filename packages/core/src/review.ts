import type { ProfileUpdate } from "@directory/contracts";
import { and, db, desc, eq, tables } from "@directory/db";

import { updateProfile } from "./profiles.ts";

/**
 * Human-review queue. Any AI/agent-suggested change to PUBLISHED content is
 * enqueued here instead of auto-applying ("humans above the loop"). One-way
 * doors are gated; two-way doors can be applied directly by their owner.
 */
export async function enqueueReview(input: {
  organizationId: string;
  profileId?: string | null;
  kind: string;
  proposedBy: "agent" | "ai";
  payload: Record<string, unknown>;
  correlationId?: string;
}): Promise<string> {
  const [row] = await db
    .insert(tables.reviewItem)
    .values({
      organizationId: input.organizationId,
      profileId: input.profileId ?? null,
      kind: input.kind,
      proposedBy: input.proposedBy,
      payload: input.payload,
      correlationId: input.correlationId,
    })
    .returning({ id: tables.reviewItem.id });
  return row!.id;
}

export async function listPendingReviews(organizationId: string) {
  return db
    .select()
    .from(tables.reviewItem)
    .where(
      and(
        eq(tables.reviewItem.organizationId, organizationId),
        eq(tables.reviewItem.status, "pending"),
      ),
    )
    .orderBy(desc(tables.reviewItem.createdAt));
}

export async function decideReview(
  organizationId: string,
  reviewItemId: string,
  decision: "approved" | "rejected",
  decidedBy: string,
): Promise<boolean> {
  // Tenant-scoped compare-and-set: an org can only decide its OWN pending items.
  // Returns false when the id doesn't match a pending item in this org (caller
  // -> 404), so a cross-tenant id can't be silently mutated or probed as a 200.
  // Doing the status flip first (CAS on status='pending') makes exactly one
  // caller the winner under a race; only the winner then applies the change.
  const rows = await db
    .update(tables.reviewItem)
    .set({ status: decision, decidedBy, decidedAt: new Date() })
    .where(
      and(
        eq(tables.reviewItem.id, reviewItemId),
        eq(tables.reviewItem.organizationId, organizationId),
        eq(tables.reviewItem.status, "pending"),
      ),
    )
    .returning({
      profileId: tables.reviewItem.profileId,
      kind: tables.reviewItem.kind,
      payload: tables.reviewItem.payload,
    });
  if (rows.length === 0) return false;

  // Approving a queued profile-change actually APPLIES it (otherwise approval is
  // a no-op). updateProfile re-validates the payload + is org-scoped.
  const item = rows[0]!;
  if (
    decision === "approved" &&
    item.kind === "profile_change_suggestion" &&
    item.profileId &&
    item.payload
  ) {
    await updateProfile(
      organizationId,
      item.profileId,
      item.payload as ProfileUpdate,
    );
  }
  return true;
}
