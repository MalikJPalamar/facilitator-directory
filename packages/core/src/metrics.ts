import { db, sql } from "@directory/db";

export type Metrics = Record<string, number>;

const METRIC_KEYS = [
  "profile_view",
  "search",
  "contact_click",
  "booking_intent",
  "agent_query",
] as const;

function zeroed(): Metrics {
  return {
    profile_views: 0,
    search_appearances: 0,
    contact_clicks: 0,
    booking_intent: 0,
    agent_queries: 0,
  };
}

function applyRow(metrics: Metrics, eventType: string, n: number): void {
  switch (eventType) {
    case "profile_view":
      metrics.profile_views = n;
      break;
    case "search":
      metrics.search_appearances = n;
      break;
    case "contact_click":
      metrics.contact_clicks = n;
      break;
    case "booking_intent":
      metrics.booking_intent = n;
      break;
    case "agent_query":
      metrics.agent_queries = n;
      break;
  }
}

/** Per-graduate metric counts over [from, to). */
export async function getProfileMetrics(
  organizationId: string,
  profileId: string,
  from: Date,
  to: Date,
): Promise<Metrics> {
  // Org-scoped: filter by organization_id AND profile_id so a profile id alone
  // can never read another tenant's events (defense-in-depth for any future
  // path that lets a caller supply a profileId).
  const rows = (await db.execute(sql`
    select event_type, count(*)::int as n
    from analytics_event
    where organization_id = ${organizationId}
      and profile_id = ${profileId}
      and occurred_at >= ${from.toISOString()}
      and occurred_at < ${to.toISOString()}
    group by event_type
  `)) as unknown as { event_type: string; n: number }[];

  const metrics = zeroed();
  for (const r of rows) applyRow(metrics, r.event_type, Number(r.n));
  return metrics;
}

/** School-wide metric counts over [from, to). */
export async function getSchoolMetrics(
  organizationId: string,
  from: Date,
  to: Date,
): Promise<Metrics> {
  const rows = (await db.execute(sql`
    select event_type, count(*)::int as n
    from analytics_event
    where organization_id = ${organizationId}
      and occurred_at >= ${from.toISOString()}
      and occurred_at < ${to.toISOString()}
    group by event_type
  `)) as unknown as { event_type: string; n: number }[];

  const metrics = zeroed();
  for (const r of rows) applyRow(metrics, r.event_type, Number(r.n));
  return metrics;
}

export function deltaOf(current: Metrics, previous: Metrics): Metrics {
  const delta: Metrics = {};
  for (const key of Object.keys(current)) {
    delta[key] = (current[key] ?? 0) - (previous[key] ?? 0);
  }
  return delta;
}

export { METRIC_KEYS };
