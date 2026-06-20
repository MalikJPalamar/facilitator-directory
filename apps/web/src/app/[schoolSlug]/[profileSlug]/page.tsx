import { profileToJsonLd } from "@directory/contracts";
import { getProfileDetail, getSchoolBySlug } from "@directory/core";

import { SITE_BASE, track } from "../../../lib/data.ts";

type Params = { schoolSlug: string; profileSlug: string };

export default async function ProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { schoolSlug, profileSlug } = await params;
  const school = await getSchoolBySlug(schoolSlug);
  if (!school)
    return <div className="page"><h1>Profile not found</h1></div>;

  const profile = await getProfileDetail(school.id, profileSlug);
  if (!profile)
    return <div className="page"><h1>Profile not found</h1></div>;

  track({
    organizationId: school.id,
    eventType: "profile_view",
    profileId: profile.id,
    actor: "human",
  });

  // Agent-readable structured data (schema.org) — the "agents as customers" affordance.
  const jsonLd = profileToJsonLd(profile, school, SITE_BASE);

  return (
    <>
      <section className="profile-hero">
        <div className="profile-hero__inner">
          <div className="profile-hero__avatar">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt={profile.displayName}
                style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              profile.displayName.charAt(0)
            )}
          </div>
          <div>
            <div className="p-card__badges" style={{ marginBottom: "var(--space-2)" }}>
              {profile.verified && <span className="badge badge-verified">✓ Verified</span>}
              {profile.offersOnline && <span className="badge badge-online">Online</span>}
            </div>
            <h1>{profile.displayName}</h1>
            <p className="meta" style={{ fontSize: "1rem", color: "rgba(255,255,255,.92)", margin: "0 0 6px" }}>
              {profile.headline}
            </p>
            <p className="meta">{[profile.city, profile.country].filter(Boolean).join(", ")}</p>
          </div>
        </div>
      </section>

      <div className="page">
        <p style={{ marginTop: 0 }}>
          <a href={`/${schoolSlug}`}>← Back to {school.name}</a>
        </p>

        <div className="profile-body">
          <div className="stack">
            <div className="panel panel--accent">
              <h2>About</h2>
              <p style={{ margin: 0 }}>{profile.bio}</p>
            </div>

            <div className="panel">
              <h2 style={{ fontSize: "var(--fs-h3)" }}>Modalities</h2>
              <div className="p-card__badges">
                {profile.modalities.map((m) => (
                  <span key={m} className="badge badge-level">{m}</span>
                ))}
              </div>
            </div>

            <div className="panel">
              <h2 style={{ fontSize: "var(--fs-h3)" }}>Certifications</h2>
              <div className="stack" style={{ gap: "var(--space-2)" }}>
                {profile.certifications.map((c, i) => (
                  <div key={i} className="contact-row">
                    <span>
                      {c.programName} {c.level ? `· ${c.level}` : ""}
                    </span>
                    {c.verified && <span className="badge badge-verified">✓</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <aside>
            <div className="panel">
              <h2 style={{ fontSize: "var(--fs-h3)" }}>Get in touch</h2>
              <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>
                {profile.acceptingClients
                  ? "Accepting new clients."
                  : "Not currently accepting new clients."}
              </p>
              <form
                method="post"
                action={`/api/v1/schools/${schoolSlug}/profiles/${profileSlug}/contact`}
              >
                <button type="submit" className="btn btn-primary btn-block" disabled={!profile.acceptingClients}>
                  Contact {profile.displayName.split(" ")[0]}
                </button>
              </form>
            </div>
          </aside>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </>
  );
}
