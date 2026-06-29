import { db, eq, sql, tables } from "@directory/db";

/**
 * Platform-level (cross-tenant) read models for the superadmin console. These
 * intentionally cross org boundaries, so they are ONLY ever called from the
 * SUPERADMIN_EMAILS-gated /superadmin surface — never from a tenant route.
 */

export type PlatformStats = {
  schools: number;
  members: number;
  graduates: number;
  publishedGraduates: number;
  payingSchools: number;
  leads: number;
  windowDays: number;
  searches: number;
  profileViews: number;
  agentQueries: number;
  contactClicks: number;
};

/** Single-round-trip rollup of platform totals + trailing-window activity. */
export async function getPlatformStats(windowDays = 30): Promise<PlatformStats> {
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  const rows = (await db.execute(sql`
    select
      (select count(*) from organization)::int as schools,
      (select count(*) from member)::int as members,
      (select count(*) from graduate_profile)::int as graduates,
      (select count(*) from graduate_profile where status = 'published')::int as published_graduates,
      (select count(*) from subscription where status in ('active','trialing'))::int as paying_schools,
      (select count(*) from lead)::int as leads,
      (select count(*) from analytics_event where event_type = 'search' and occurred_at >= ${since})::int as searches,
      (select count(*) from analytics_event where event_type = 'profile_view' and occurred_at >= ${since})::int as profile_views,
      (select count(*) from analytics_event where event_type = 'agent_query' and occurred_at >= ${since})::int as agent_queries,
      (select count(*) from analytics_event where event_type = 'contact_click' and occurred_at >= ${since})::int as contact_clicks
  `)) as unknown as Array<Record<string, number>>;
  const r = rows[0] ?? {};
  return {
    schools: Number(r.schools ?? 0),
    members: Number(r.members ?? 0),
    graduates: Number(r.graduates ?? 0),
    publishedGraduates: Number(r.published_graduates ?? 0),
    payingSchools: Number(r.paying_schools ?? 0),
    leads: Number(r.leads ?? 0),
    windowDays,
    searches: Number(r.searches ?? 0),
    profileViews: Number(r.profile_views ?? 0),
    agentQueries: Number(r.agent_queries ?? 0),
    contactClicks: Number(r.contact_clicks ?? 0),
  };
}

export type SchoolMember = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export type SchoolDetail = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  themeColor: string | null;
  subscription: {
    status: string;
    plan: string;
    seats: number;
    currentPeriodEnd: Date | null;
  } | null;
  members: SchoolMember[];
  graduateCount: number;
  publishedCount: number;
  apiKeyCount: number;
  webhookCount: number;
  recent: {
    windowDays: number;
    searches: number;
    profileViews: number;
    agentQueries: number;
    leads: number;
  };
};

/** Full drill-down for one school (superadmin only). Null if the org is gone. */
export async function getSchoolDetail(
  organizationId: string,
  windowDays = 30,
): Promise<SchoolDetail | null> {
  const [org] = await db
    .select({
      id: tables.organization.id,
      name: tables.organization.name,
      slug: tables.organization.slug,
      createdAt: tables.organization.createdAt,
      metadata: tables.organization.metadata,
    })
    .from(tables.organization)
    .where(eq(tables.organization.id, organizationId))
    .limit(1);
  if (!org) return null;

  const [sub] = await db
    .select({
      status: tables.subscription.status,
      plan: tables.subscription.plan,
      seats: tables.subscription.seats,
      currentPeriodEnd: tables.subscription.currentPeriodEnd,
    })
    .from(tables.subscription)
    .where(eq(tables.subscription.organizationId, organizationId))
    .limit(1);

  const members = await db
    .select({
      id: tables.member.id,
      role: tables.member.role,
      name: tables.user.name,
      email: tables.user.email,
    })
    .from(tables.member)
    .innerJoin(tables.user, eq(tables.member.userId, tables.user.id))
    .where(eq(tables.member.organizationId, organizationId));

  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  const rows = (await db.execute(sql`
    select
      (select count(*) from graduate_profile where organization_id = ${organizationId})::int as grads,
      (select count(*) from graduate_profile where organization_id = ${organizationId} and status = 'published')::int as published,
      (select count(*) from api_key where organization_id = ${organizationId} and revoked_at is null)::int as keys,
      (select count(*) from webhook_endpoint where organization_id = ${organizationId})::int as webhooks,
      (select count(*) from analytics_event where organization_id = ${organizationId} and event_type = 'search' and occurred_at >= ${since})::int as searches,
      (select count(*) from analytics_event where organization_id = ${organizationId} and event_type = 'profile_view' and occurred_at >= ${since})::int as profile_views,
      (select count(*) from analytics_event where organization_id = ${organizationId} and event_type = 'agent_query' and occurred_at >= ${since})::int as agent_queries,
      (select count(*) from lead where organization_id = ${organizationId})::int as leads
  `)) as unknown as Array<Record<string, number>>;
  const c = rows[0] ?? {};

  const meta = (org.metadata ?? {}) as Record<string, unknown>;
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    createdAt: org.createdAt,
    themeColor: typeof meta.themeColor === "string" ? meta.themeColor : null,
    subscription: sub ?? null,
    members,
    graduateCount: Number(c.grads ?? 0),
    publishedCount: Number(c.published ?? 0),
    apiKeyCount: Number(c.keys ?? 0),
    webhookCount: Number(c.webhooks ?? 0),
    recent: {
      windowDays,
      searches: Number(c.searches ?? 0),
      profileViews: Number(c.profile_views ?? 0),
      agentQueries: Number(c.agent_queries ?? 0),
      leads: Number(c.leads ?? 0),
    },
  };
}
