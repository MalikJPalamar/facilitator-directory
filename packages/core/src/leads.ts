import { and, db, desc, eq, tables } from "@directory/db";

/** A typed not-found so the API layer can map it to a 404 envelope. */
export class LeadError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "LeadError";
  }
}

/**
 * Persist an inbound lead written by an agent/CRM. The lead row IS the event of
 * record. If a `profileId` is supplied it MUST belong to `organizationId` — this
 * is the cross-tenant IDOR guard; never trust a caller-supplied profile id.
 */
export async function createLead(input: {
  organizationId: string;
  profileId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  message?: string;
  kind?: string;
  source?: string;
  props?: Record<string, unknown>;
  submittedBy?: string;
}): Promise<{ id: string; createdAt: string }> {
  if (input.profileId) {
    const [p] = await db
      .select({ id: tables.graduateProfile.id })
      .from(tables.graduateProfile)
      .where(
        and(
          eq(tables.graduateProfile.id, input.profileId),
          eq(tables.graduateProfile.organizationId, input.organizationId),
        ),
      )
      .limit(1);
    if (!p) throw new LeadError("profile not found", 404);
  }
  const [row] = await db
    .insert(tables.lead)
    .values({
      organizationId: input.organizationId,
      profileId: input.profileId ?? null,
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      message: input.message,
      kind: input.kind ?? "contact_request",
      source: input.source,
      props: input.props ?? {},
      submittedBy: input.submittedBy,
    })
    .returning({
      id: tables.lead.id,
      createdAt: tables.lead.createdAt,
    });
  return { id: row!.id, createdAt: row!.createdAt.toISOString() };
}

/** Admin view: most-recent leads for a school (newest first). */
export async function listLeads(organizationId: string, limit = 100) {
  return db
    .select()
    .from(tables.lead)
    .where(eq(tables.lead.organizationId, organizationId))
    .orderBy(desc(tables.lead.createdAt))
    .limit(limit);
}
