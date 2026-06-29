import { getSchoolBySlug } from "@directory/core";
import { ArrowRight, Search, Sparkles } from "lucide-react";

import styles from "./directory-home.module.css";

export const metadata = {
  title: "Find a certified practitioner you can trust — The Directory",
  description:
    "Browse verified, certified practitioners across trusted schools. Searchable by people and their AI agents.",
};

/**
 * Seeded school slugs to feature on the global entry point. Listing *all* orgs
 * is not exposed by `@directory/core` (and `apps/web` intentionally doesn't
 * depend on `@directory/db`), so we hydrate the known published schools via the
 * public `getSchoolBySlug` loader and render whichever resolve. New schools get
 * added here, or this becomes a `listSchools()` core export later.
 */
const FEATURED_SLUGS = ["breathwork-global"];

function logoInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default async function DirectoryHome() {
  const resolved = await Promise.all(FEATURED_SLUGS.map((slug) => getSchoolBySlug(slug)));
  const schools = resolved.filter((s): s is NonNullable<typeof s> => s !== null);

  // Always have a search destination, even before any school resolves.
  const searchSlug = schools[0]?.slug ?? "breathwork-global";

  return (
    <>
      <section className={styles.hero}>
        <span className="eyebrow">The Directory</span>
        <h1 className={styles.heroTitle}>Find a certified practitioner you can trust</h1>
        <p className={styles.heroLead}>
          Every practitioner here is a verified graduate of a recognized school — searchable by
          you, and by your AI agent.
        </p>
        <form className={styles.searchWrap} action={`/${searchSlug}`} method="get">
          <label className="searchbar" htmlFor="global-search">
            <Search size={18} aria-hidden style={{ color: "var(--color-text-faint)", flexShrink: 0 }} />
            <input
              id="global-search"
              className="input"
              name="q"
              type="search"
              placeholder="Try: gentle breathwork for anxiety…"
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </label>
        </form>
      </section>

      <div className="page">
        <div className={styles.sectionHead}>
          <h2>Browse by school</h2>
          <span className="muted" style={{ fontSize: "var(--fs-sm)" }}>
            {schools.length > 0
              ? `${schools.length} ${schools.length === 1 ? "directory" : "directories"}`
              : ""}
          </span>
        </div>

        <div className="directory-grid directory-grid--3">
          {(schools.length > 0
            ? schools
            : [{ slug: "breathwork-global", name: "Breathwork Global", logo: null, heroCopy: null }]
          ).map((s, i) => (
            <a key={s.slug} className={styles.schoolCard} href={`/${s.slug}`}>
              <div className={styles.schoolBanner}>
                <div className={styles.schoolLogo}>
                  {s.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logo} alt={`${s.name} logo`} />
                  ) : (
                    logoInitials(s.name)
                  )}
                </div>
              </div>
              <div className={styles.schoolBody}>
                <h3 className={styles.schoolName}>{s.name}</h3>
                <p className={styles.schoolCopy}>
                  {s.heroCopy ?? "Verified, certified practitioners ready to work with you."}
                </p>
                <div className={styles.schoolMeta}>
                  <span className={styles.schoolCount}>
                    <Sparkles size={14} aria-hidden /> {i === 0 ? "Featured" : "Directory"}
                  </span>
                  <span className={styles.schoolCta}>
                    Explore <ArrowRight size={14} aria-hidden />
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </>
  );
}
