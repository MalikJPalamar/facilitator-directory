import { SearchQuery } from "@directory/contracts";
import { getSchoolBySlug, searchDirectory } from "@directory/core";

import { track } from "../../lib/data.ts";

type Params = { schoolSlug: string };
type Search = { q?: string; modality?: string };

export default async function DirectoryPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { schoolSlug } = await params;
  const sp = await searchParams;

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) return <main><h1>School not found</h1></main>;

  const parsed = SearchQuery.safeParse({ q: sp.q, modality: sp.modality });
  const query = parsed.success ? parsed.data : SearchQuery.parse({});
  const data = await searchDirectory(school.id, query);
  const results = data.results;

  track({
    organizationId: school.id,
    eventType: "search",
    actor: "human",
    props: { q: sp.q, modality: sp.modality },
  });

  return (
    <>
      <section className="hero">
        <h1 style={{ color: "#fff" }}>{school.name}</h1>
        <p>{school.heroCopy}</p>
      </section>

      <div className="page">
        <form className="searchbar" style={{ marginTop: "calc(-1 * var(--space-8))" }}>
          <input
            className="input"
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Try: gentle breathwork for anxiety…"
          />
          <button type="submit" className="btn btn-primary">Search</button>
        </form>

        <p className="results-count">
          {results.length} {results.length === 1 ? "practitioner" : "practitioners"}
          {sp.q ? ` for “${sp.q}”` : ""}
        </p>

        {results.length === 0 ? (
          <div className="panel">
            <p className="muted" style={{ margin: 0 }}>No practitioners match yet — try a broader search.</p>
          </div>
        ) : (
          <div className="directory-grid">
            {results.map((p) => (
              <a key={p.id} className="p-card" href={`/${schoolSlug}/${p.slug}`}>
                <div className="p-card__media">
                  {p.avatarUrl ? (
                    <img src={p.avatarUrl} alt={p.displayName} loading="lazy" />
                  ) : (
                    <span className="p-card__monogram">{p.displayName.charAt(0)}</span>
                  )}
                </div>
                <div className="p-card__body">
                  <div className="p-card__badges">
                    {p.verified && <span className="badge badge-verified">✓ Verified</span>}
                    {p.offersOnline && <span className="badge badge-online">Online</span>}
                    {p.modalities.slice(0, 2).map((m) => (
                      <span key={m} className="badge badge-level">{m}</span>
                    ))}
                  </div>
                  <h3 className="p-card__name">{p.displayName}</h3>
                  <p className="p-card__headline">{p.headline}</p>
                  <p className="p-card__location">
                    {[p.city, p.country].filter(Boolean).join(", ")}
                    {typeof p.distanceKm === "number" ? ` · ${p.distanceKm.toFixed(0)} km` : ""}
                  </p>
                  <span className="btn btn-primary btn-block">View profile</span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
