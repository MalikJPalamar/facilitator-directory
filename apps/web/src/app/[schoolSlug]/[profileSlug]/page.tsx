import type { ProfileDetail } from "@directory/contracts";

import { API_BASE, apiGet } from "../../../lib/api.ts";

type Params = { schoolSlug: string; profileSlug: string };

export default async function ProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { schoolSlug, profileSlug } = await params;
  const profile = await apiGet<ProfileDetail>(
    `/v1/schools/${schoolSlug}/profiles/${profileSlug}`,
  );
  if (!profile) return <main><h1>Profile not found</h1></main>;

  // Agent-readable structured data (schema.org) served from the API.
  const jsonLd = await apiGet<Record<string, unknown>>(
    `/v1/schools/${schoolSlug}/profiles/${profileSlug}?format=jsonld`,
  );

  return (
    <main>
      <p><a href={`/${schoolSlug}`}>← Back to directory</a></p>
      <h1>{profile.displayName}</h1>
      <p style={{ color: "#3B7A8C" }}>{profile.headline}</p>
      <p style={{ color: "#5a6b6f", fontSize: ".9rem" }}>
        {[profile.city, profile.country].filter(Boolean).join(", ")}
        {profile.verified ? " · ✓ Certification verified" : ""}
        {profile.offersOnline ? " · Online sessions" : ""}
      </p>
      <p>{profile.bio}</p>
      <h3>Modalities</h3>
      <p>{profile.modalities.join(" · ")}</p>
      <h3>Certifications</h3>
      <ul>
        {profile.certifications.map((c, i) => (
          <li key={i}>
            {c.programName} {c.level ? `(${c.level})` : ""} {c.verified ? "✓" : ""}
          </li>
        ))}
      </ul>
      <form method="post" action={`${API_BASE}/v1/schools/${schoolSlug}/profiles/${profileSlug}/contact`}>
        <button type="submit" style={{ padding: "8px 14px" }}>Contact {profile.displayName.split(" ")[0]}</button>
      </form>

      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
    </main>
  );
}
