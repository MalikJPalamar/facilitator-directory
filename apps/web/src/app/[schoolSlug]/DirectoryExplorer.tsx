"use client";

import type { ProfileSummary } from "@directory/contracts";
import { BadgeCheck, Globe, MapPin, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

import styles from "./directory.module.css";

type Props = {
  schoolSlug: string;
  roster: ProfileSummary[];
};

/** Initials monogram for a name with no avatar photo. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function DirectoryExplorer({ schoolSlug, roster }: Props) {
  const [q, setQ] = useState("");
  const [modality, setModality] = useState<string | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [onlineOnly, setOnlineOnly] = useState(false);

  // Build the facet universes once from the full roster.
  const modalities = useMemo(() => {
    const set = new Map<string, number>();
    for (const p of roster) {
      for (const m of p.modalities) set.set(m, (set.get(m) ?? 0) + 1);
    }
    return [...set.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
  }, [roster]);

  const countries = useMemo(() => {
    const set = new Map<string, number>();
    for (const p of roster) {
      if (p.country) set.set(p.country, (set.get(p.country) ?? 0) + 1);
    }
    return [...set.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [roster]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return roster.filter((p) => {
      if (onlineOnly && !p.offersOnline) return false;
      if (modality && !p.modalities.includes(modality)) return false;
      if (country && p.country !== country) return false;
      if (needle) {
        const hay = [
          p.displayName,
          p.headline ?? "",
          p.city ?? "",
          p.country ?? "",
          ...p.modalities,
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [roster, q, modality, country, onlineOnly]);

  const hasFilters = Boolean(q || modality || country || onlineOnly);

  function clearAll() {
    setQ("");
    setModality(null);
    setCountry(null);
    setOnlineOnly(false);
  }

  return (
    <>
      <div className={styles.controls}>
        <label className="searchbar" htmlFor="dir-search">
          <Search size={18} aria-hidden style={{ color: "var(--color-text-faint)", flexShrink: 0 }} />
          <input
            id="dir-search"
            className="input"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, modality, or focus…"
            autoComplete="off"
          />
        </label>

        {(modalities.length > 0 || countries.length > 0) && (
          <div className={styles.facets}>
            <button
              type="button"
              className={`chip ${onlineOnly ? "chip--active" : ""}`}
              onClick={() => setOnlineOnly((v) => !v)}
              aria-pressed={onlineOnly}
            >
              <Globe size={14} aria-hidden /> Online
            </button>

            {modalities.map((m) => (
              <button
                key={m}
                type="button"
                className={`chip ${modality === m ? "chip--active" : ""}`}
                onClick={() => setModality((v) => (v === m ? null : m))}
                aria-pressed={modality === m}
              >
                {m}
              </button>
            ))}

            {countries.map((c) => (
              <button
                key={c}
                type="button"
                className={`chip ${country === c ? "chip--active" : ""}`}
                onClick={() => setCountry((v) => (v === c ? null : c))}
                aria-pressed={country === c}
              >
                <MapPin size={14} aria-hidden /> {c}
              </button>
            ))}

            {hasFilters && (
              <button type="button" className={`chip ${styles.clearChip}`} onClick={clearAll}>
                <X size={14} aria-hidden /> Clear
              </button>
            )}
          </div>
        )}
      </div>

      <p className="results-count">
        {filtered.length} {filtered.length === 1 ? "practitioner" : "practitioners"}
        {hasFilters ? " match your filters" : " available"}
      </p>

      {filtered.length === 0 ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            No practitioners match yet — try a broader search or clear your filters.
          </p>
        </div>
      ) : (
        <div className="directory-grid">
          {filtered.map((p) => {
            const location = [p.city, p.country].filter(Boolean).join(", ");
            return (
              <a key={p.id} className="p-card" href={`/${schoolSlug}/${p.slug}`}>
                <div className="p-card__media">
                  {p.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatarUrl} alt={p.displayName} loading="lazy" />
                  ) : (
                    <span className="p-card__monogram">{initials(p.displayName)}</span>
                  )}
                  {p.offersOnline && (
                    <span className={`badge badge-featured ${styles.onlineTag}`}>
                      <Globe size={12} aria-hidden /> Online
                    </span>
                  )}
                </div>
                <div className="p-card__body">
                  <div className="p-card__badges">
                    {p.verified && (
                      <span className="badge badge-verified">
                        <BadgeCheck size={13} aria-hidden /> Verified
                      </span>
                    )}
                    {p.modalities.slice(0, 2).map((m) => (
                      <span key={m} className="badge badge-level">
                        {m}
                      </span>
                    ))}
                  </div>
                  <h3 className="p-card__name">{p.displayName}</h3>
                  {p.headline && <p className="p-card__headline">{p.headline}</p>}
                  {location && (
                    <p className="p-card__location">
                      <MapPin size={14} aria-hidden /> {location}
                    </p>
                  )}
                  <span className="btn btn-primary btn-block">View profile</span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </>
  );
}
