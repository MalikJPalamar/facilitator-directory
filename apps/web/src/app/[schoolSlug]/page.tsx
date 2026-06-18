import type { SchoolPublic, SearchResult } from "@directory/contracts";

import { apiGet } from "../../lib/api.ts";

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

  const school = await apiGet<SchoolPublic>(`/v1/schools/${schoolSlug}`);
  if (!school) return <main><h1>School not found</h1></main>;

  const qs = new URLSearchParams();
  if (sp.q) qs.set("q", sp.q);
  if (sp.modality) qs.set("modality", sp.modality);
  const data = await apiGet<SearchResult>(
    `/v1/schools/${schoolSlug}/search?${qs.toString()}`,
  );
  const results = data?.results ?? [];

  return (
    <main>
      <h1 style={{ color: school.themeColor ?? "#3B7A8C" }}>{school.name}</h1>
      <p>{school.heroCopy}</p>

      <form style={{ margin: "16px 0", display: "flex", gap: 8 }}>
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Try: gentle breathwork for anxiety…"
          style={{ flex: 1, padding: 8, borderRadius: 8, border: "1px solid #cdd9da" }}
        />
        <button type="submit" style={{ padding: "8px 14px" }}>Search</button>
      </form>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16 }}>
        {results.map((p) => (
          <article key={p.id} style={{ border: "1px solid #e2e8e9", borderRadius: 12, padding: 16, background: "#fff" }}>
            <h3 style={{ margin: "0 0 4px" }}>
              <a href={`/${schoolSlug}/${p.slug}`}>{p.displayName}</a>
            </h3>
            <p style={{ margin: "0 0 8px", color: "#3B7A8C", fontSize: ".9rem" }}>{p.headline}</p>
            <p style={{ margin: 0, fontSize: ".8rem", color: "#5a6b6f" }}>
              {[p.city, p.country].filter(Boolean).join(", ")}
              {p.verified ? " · ✓ Verified" : ""}
              {p.offersOnline ? " · Online" : ""}
              {typeof p.distanceKm === "number" ? ` · ${p.distanceKm.toFixed(0)} km` : ""}
            </p>
            <p style={{ margin: "8px 0 0", fontSize: ".8rem" }}>{p.modalities.join(" · ")}</p>
            <p style={{ margin: "8px 0 0", fontSize: ".75rem" }}>
              <a href={`/me?profile=${p.id}`}>View AI insights (demo)</a>
            </p>
          </article>
        ))}
        {results.length === 0 && <p>No practitioners found.</p>}
      </div>
    </main>
  );
}
