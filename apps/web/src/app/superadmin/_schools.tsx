"use client";

import type { SchoolSummary } from "@directory/core";
import { ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";

import styles from "./superadmin.module.css";

/**
 * The schools list for the superadmin index, with a client-side name/slug
 * filter. Fine at five schools, necessary at scale — the operator types a
 * fragment and the grid narrows. Each row links to the per-school drill-down;
 * the subscription state uses the shared neutral/online badges so it reads like
 * the rest of the app. The data is fetched server-side and handed in as a prop.
 */
export function SchoolsList({ schools }: { schools: SchoolSummary[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.slug.toLowerCase().includes(q),
    );
  }, [query, schools]);

  return (
    <>
      <div className={styles.sectionHead}>
        <h2>Schools</h2>
        <span className="results-count" style={{ margin: 0 }}>
          {query.trim()
            ? `${filtered.length} of ${schools.length}`
            : `${schools.length} total`}
        </span>
      </div>

      {schools.length > 0 ? (
        <label className="searchbar" style={{ marginBottom: "var(--space-4)" }}>
          <Search size={16} aria-hidden style={{ color: "var(--color-text-faint)" }} />
          <input
            className="input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter schools by name or slug…"
            aria-label="Filter schools by name or slug"
          />
        </label>
      ) : null}

      {schools.length === 0 ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            No schools yet.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <span className="empty-state__icon">
            <Search size={28} aria-hidden />
          </span>
          <h3>No matches</h3>
          <p>
            No school matches &ldquo;{query.trim()}&rdquo;. Try a shorter
            fragment of the name or slug.
          </p>
        </div>
      ) : (
        <div className={styles.schoolGrid}>
          {filtered.map((s) => {
            const paying =
              s.subscriptionStatus === "active" ||
              s.subscriptionStatus === "trialing";
            return (
              <a
                key={s.id}
                href={`/superadmin/${s.id}`}
                className={styles.schoolCard}
              >
                <span className={styles.schoolMain}>
                  <span className={styles.schoolName}>{s.name}</span>
                  <span className={styles.schoolSlug}>/{s.slug}</span>
                  <span className={styles.schoolMeta}>
                    {s.memberCount.toLocaleString()} member
                    {s.memberCount === 1 ? "" : "s"} ·{" "}
                    {s.graduateCount.toLocaleString()} grad
                    {s.graduateCount === 1 ? "" : "s"} · created{" "}
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </span>
                <span className={styles.schoolRight}>
                  <span
                    className={`badge ${paying ? "badge-online" : "badge-neutral"}`}
                  >
                    {s.subscriptionStatus || "none"}
                  </span>
                  <ChevronRight size={18} className={styles.chevron} aria-hidden />
                </span>
              </a>
            );
          })}
        </div>
      )}
    </>
  );
}
