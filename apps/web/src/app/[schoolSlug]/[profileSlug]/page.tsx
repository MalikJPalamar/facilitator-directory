import { profileToJsonLd } from "@directory/contracts";
import { getProfileDetail, getSchoolBySlug } from "@directory/core";
import { ArrowLeft, BadgeCheck, ExternalLink, Globe, MapPin } from "lucide-react";

import { SITE_BASE, track } from "../../../lib/data.ts";
import styles from "./profile.module.css";

type Params = { schoolSlug: string; profileSlug: string };

export default async function ProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { schoolSlug, profileSlug } = await params;
  const school = await getSchoolBySlug(schoolSlug);
  if (!school) return <div className="page"><h1>Profile not found</h1></div>;

  const profile = await getProfileDetail(school.id, profileSlug);
  if (!profile) return <div className="page"><h1>Profile not found</h1></div>;

  track({
    organizationId: school.id,
    eventType: "profile_view",
    profileId: profile.id,
    actor: "human",
  });

  // Agent-readable structured data (schema.org) — the "agents as customers" affordance.
  const jsonLd = profileToJsonLd(profile, school, SITE_BASE);

  const location = [profile.city, profile.country].filter(Boolean).join(", ");
  const firstName = profile.displayName.split(" ")[0];
  const website = profile.links?.website;
  const otherLinks = Object.entries(profile.links ?? {}).filter(
    ([k, v]) => k !== "website" && typeof v === "string" && v,
  );
  const pricing = Object.entries(profile.pricing ?? {}).filter(
    ([, v]) => v != null && v !== "",
  );

  return (
    <>
      <section
        className="profile-hero"
        style={
          school.themeColor
            ? ({ "--color-accent": school.themeColor } as React.CSSProperties)
            : undefined
        }
      >
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
            <div className="p-card__badges" style={{ marginBottom: "var(--space-3)" }}>
              {profile.verified && (
                <span className="badge badge-verified">
                  <BadgeCheck size={13} aria-hidden /> Verified
                </span>
              )}
              {profile.offersOnline && (
                <span className="badge badge-online">Online sessions</span>
              )}
            </div>
            <h1>{profile.displayName}</h1>
            {profile.headline && (
              <p
                className="meta"
                style={{ fontSize: "1.0625rem", color: "var(--color-text)", margin: "0 0 8px", maxWidth: "52ch" }}
              >
                {profile.headline}
              </p>
            )}
            {location && (
              <p className="meta">
                <span className={styles.heroMeta}>
                  <MapPin size={15} aria-hidden /> {location}
                </span>
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="page">
        <p style={{ marginTop: 0 }}>
          <a className={styles.backLink} href={`/${schoolSlug}`}>
            <ArrowLeft size={15} aria-hidden /> Back to {school.name}
          </a>
        </p>

        <div className="profile-body">
          <div className="stack">
            {profile.bio && (
              <div className="panel panel--accent">
                <h2>About</h2>
                <p style={{ margin: 0, whiteSpace: "pre-line", lineHeight: 1.6 }}>{profile.bio}</p>
              </div>
            )}

            {profile.modalities.length > 0 && (
              <div className="panel">
                <h2 style={{ fontSize: "var(--fs-h3)" }}>Modalities</h2>
                <div className="p-card__badges">
                  {profile.modalities.map((m) => (
                    <span key={m} className="badge badge-level">{m}</span>
                  ))}
                </div>
              </div>
            )}

            {profile.certifications.length > 0 && (
              <div className="panel">
                <h2 style={{ fontSize: "var(--fs-h3)" }}>Certifications</h2>
                <div className="stack" style={{ gap: "var(--space-2)" }}>
                  {profile.certifications.map((c, i) => (
                    <div key={i} className="contact-row">
                      <span>
                        {c.programName}
                        {c.level ? ` · ${c.level}` : ""}
                      </span>
                      {c.verified && (
                        <span className="badge badge-verified">
                          <BadgeCheck size={13} aria-hidden /> Verified
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profile.gallery.length > 0 && (
              <div className="panel">
                <h2 style={{ fontSize: "var(--fs-h3)" }}>Gallery</h2>
                <div className={styles.gallery}>
                  {profile.gallery.map((src, i) => (
                    <figure key={i} className={styles.galleryItem}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt={`${profile.displayName} — ${i + 1}`} loading="lazy" />
                    </figure>
                  ))}
                </div>
              </div>
            )}
          </div>

          <aside className={styles.sidebar}>
            <div className="panel">
              <h2 style={{ fontSize: "var(--fs-h3)" }}>Work with {firstName}</h2>
              <p
                className={`${styles.status} ${
                  profile.acceptingClients ? styles.statusOpen : styles.statusClosed
                }`}
              >
                <span className={styles.statusDot} aria-hidden />
                {profile.acceptingClients ? "Accepting new clients" : "Not currently accepting clients"}
              </p>

              {pricing.length > 0 && (
                <div style={{ margin: "0 0 var(--space-4)" }}>
                  {pricing.map(([label, value]) => (
                    <div key={label} className={styles.pricingRow}>
                      <span className="label">{label}</span>
                      <span className="value">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}

              <form
                method="post"
                action={`/api/v1/schools/${schoolSlug}/profiles/${profileSlug}/contact`}
              >
                <button
                  type="submit"
                  className="btn btn-primary btn-block"
                  disabled={!profile.acceptingClients}
                >
                  Contact {firstName}
                </button>
              </form>
            </div>

            {(website || profile.offersOnline || otherLinks.length > 0) && (
              <div className="panel">
                <h2 style={{ fontSize: "var(--fs-h3)" }}>Links</h2>
                <div className={styles.links}>
                  {website && (
                    <a className={styles.linkRow} href={website} target="_blank" rel="noopener noreferrer nofollow">
                      <Globe size={15} aria-hidden /> Website
                      <ExternalLink size={13} aria-hidden style={{ opacity: 0.6 }} />
                    </a>
                  )}
                  {otherLinks.map(([label, href]) => (
                    <a
                      key={label}
                      className={styles.linkRow}
                      href={String(href)}
                      target="_blank"
                      rel="noopener noreferrer nofollow"
                    >
                      <ExternalLink size={15} aria-hidden />{" "}
                      <span style={{ textTransform: "capitalize" }}>{label}</span>
                    </a>
                  ))}
                  {profile.offersOnline && (
                    <span className={styles.linkRow}>
                      <Globe size={15} aria-hidden /> Offers online sessions
                    </span>
                  )}
                </div>
              </div>
            )}
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
