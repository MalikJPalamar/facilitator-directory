import { SearchQuery } from "@directory/contracts";
import { getSchoolBySlug, searchDirectory } from "@directory/core";

import { track } from "../../lib/data.ts";
import DirectoryExplorer from "./DirectoryExplorer.tsx";
import styles from "./directory.module.css";

type Params = { schoolSlug: string };

/** Initials for the school logo fallback. */
function schoolInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default async function DirectoryPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { schoolSlug } = await params;

  const school = await getSchoolBySlug(schoolSlug);
  if (!school) {
    return (
      <div className="page">
        <h1 className="display">School not found</h1>
        <p className="lead">
          We couldn’t find a directory at <code>/{schoolSlug}</code>.{" "}
          <a href="/directory">Browse all directories →</a>
        </p>
      </div>
    );
  }

  // Load the full published roster up front (max page size) so the client can
  // filter in-memory — snappy, no per-keystroke round-trip. Empty query => the
  // search path orders by recency and returns the whole published set.
  const query = SearchQuery.parse({ pageSize: 50 });
  const data = await searchDirectory(school.id, query);
  const roster = data.results;

  track({
    organizationId: school.id,
    eventType: "search",
    actor: "human",
    props: { surface: "school_directory" },
  });

  const accent = school.themeColor ?? undefined;

  return (
    <>
      <section
        className={styles.brandHeader}
        style={accent ? ({ "--color-accent": accent } as React.CSSProperties) : undefined}
      >
        <div className={styles.brandHeaderInner}>
          <div className={styles.logo} aria-hidden={!school.logo}>
            {school.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={school.logo} alt={`${school.name} logo`} />
            ) : (
              schoolInitials(school.name)
            )}
          </div>
          <div>
            <span className="eyebrow">Certified practitioner directory</span>
            <h1 className={styles.brandTitle}>{school.name}</h1>
            <p className={styles.brandCopy}>
              {school.heroCopy ??
                "Browse certified graduates you can trust — verified, searchable, and ready to work with you."}
            </p>
          </div>
        </div>
      </section>

      <div className="page" style={{ paddingTop: "var(--space-7)" }}>
        <DirectoryExplorer schoolSlug={schoolSlug} roster={roster} />
      </div>
    </>
  );
}
