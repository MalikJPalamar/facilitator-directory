import { and, db, desc, eq, tables } from "@directory/db";

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
  reviewItemId: string,
  decision: "approved" | "rejected",
  decidedBy: string,
): Promise<void> {
  await db
    .update(tables.reviewItem)
    .set({ status: decision, decidedBy, decidedAt: new Date() })
    .where(eq(tables.reviewItem.id, reviewItemId));
}
