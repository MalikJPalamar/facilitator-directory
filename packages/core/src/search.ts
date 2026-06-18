import { embed } from "@directory/ai";
import type { ProfileSummary, SearchQuery, SearchResult } from "@directory/contracts";
import { db, sql } from "@directory/db";

type Row = {
  id: string;
  slug: string;
  displayName: string;
  headline: string | null;
  avatarUrl: string | null;
  acceptingClients: boolean;
  city: string | null;
  country: string | null;
  offersOnline: boolean;
  modalities: string[] | null;
  verified: boolean;
  distanceKm: number | null;
  relevance: number | null;
};

/**
 * Directory search: faceted + geo (PostGIS) + semantic (pgvector), in one query.
 * Ordering prefers semantic relevance when a text query is given, else distance
 * when a location is given, else recency. This same path serves the public web
 * UI, the WordPress/Web-Component adapters, and the MCP discovery tool.
 */
export async function searchDirectory(
  organizationId: string,
  query: SearchQuery,
): Promise<SearchResult> {
  const { q, modality, lat, lng, radiusKm, online, page, pageSize } = query;
  const useGeo = typeof lat === "number" && typeof lng === "number";
  const useSem = Boolean(q && q.trim().length > 0);
  const embLiteral = useSem ? `[${embed(q as string).join(",")}]` : null;

  const filters = [
    sql`p.organization_id = ${organizationId}`,
    sql`p.status = 'published'`,
  ];
  if (modality) {
    filters.push(sql`exists (
      select 1 from profile_modality pm
      join modality m on m.id = pm.modality_id
      where pm.profile_id = p.id and m.slug = ${modality}
    )`);
  }
  if (online) filters.push(sql`loc.offers_online = true`);
  if (useGeo) {
    filters.push(sql`loc.geog is not null and ST_DWithin(
      loc.geog,
      ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
      ${radiusKm * 1000}
    )`);
  }
  const where = sql.join(filters, sql` and `);

  const distanceSel = useGeo
    ? sql`ST_Distance(loc.geog, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000.0`
    : sql`null::float`;
  const relevanceSel =
    useSem && embLiteral
      ? sql`1 - (p.embedding <=> ${embLiteral}::vector)`
      : sql`null::float`;
  const orderBy = useSem
    ? sql`relevance desc nulls last`
    : useGeo
      ? sql`"distanceKm" asc nulls last`
      : sql`p.updated_at desc`;

  const offset = (page - 1) * pageSize;

  const rows = (await db.execute(sql`
    select
      p.id, p.slug,
      p.display_name as "displayName",
      p.headline,
      p.avatar_url as "avatarUrl",
      p.accepting_clients as "acceptingClients",
      loc.city, loc.country,
      coalesce(loc.offers_online, false) as "offersOnline",
      coalesce(mods.modalities, array[]::text[]) as modalities,
      coalesce(cert.verified, false) as verified,
      ${distanceSel} as "distanceKm",
      ${relevanceSel} as relevance
    from graduate_profile p
    left join lateral (
      select l.city, l.country, l.offers_online, l.geog
      from location l where l.profile_id = p.id
      order by l.id limit 1
    ) loc on true
    left join lateral (
      select array_agg(m.name) as modalities
      from profile_modality pm join modality m on m.id = pm.modality_id
      where pm.profile_id = p.id
    ) mods on true
    left join lateral (
      select bool_or(c.verified) as verified
      from certification c where c.profile_id = p.id
    ) cert on true
    where ${where}
    order by ${orderBy}
    limit ${pageSize} offset ${offset}
  `)) as unknown as Row[];

  const countRows = (await db.execute(sql`
    select count(*)::int as n
    from graduate_profile p
    left join lateral (
      select l.offers_online, l.geog from location l
      where l.profile_id = p.id order by l.id limit 1
    ) loc on true
    where ${where}
  `)) as unknown as { n: number }[];

  const results: ProfileSummary[] = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    displayName: r.displayName,
    headline: r.headline,
    avatarUrl: r.avatarUrl,
    modalities: r.modalities ?? [],
    city: r.city,
    country: r.country,
    offersOnline: r.offersOnline,
    acceptingClients: r.acceptingClients,
    verified: r.verified,
    distanceKm: r.distanceKm,
    relevance: r.relevance,
  }));

  return {
    results,
    page,
    pageSize,
    total: countRows[0]?.n ?? results.length,
  };
}
