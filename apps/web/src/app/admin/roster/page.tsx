import { listSchoolGraduates } from "@directory/core";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../../lib/auth-session.ts";
import { emitClaimLink } from "../actions.ts";
import styles from "../admin-shell.module.css";
import { bulkImportRoster } from "./actions.ts";

const SAMPLE_JSON = `[
  {
    "displayName": "Ada Rivera",
    "headline": "Somatic coach",
    "modalities": ["Somatic Experiencing", "Breathwork"],
    "city": "Lisbon",
    "country": "PT",
    "program": "Level 2 Practitioner"
  },
  { "displayName": "Liam Chen", "modalities": ["Mindfulness"] }
]`;

const SAMPLE_CSV = `displayName,modalities,city,country,program
Ada Rivera,"Somatic Experiencing;Breathwork",Lisbon,PT,Level 2 Practitioner
Liam Chen,Mindfulness,,,`;

/**
 * Roster management — the school's facilitator list as a control surface.
 * A table of current graduates with status + a per-row "emit claim link"
 * (reuses the shared `emitClaimLink` action; the copyable token surfaces on the
 * Overview), and a bulk-import form that pastes JSON or CSV rows into
 * `importRoster` to create unclaimed draft profiles. Import results come back
 * through the URL. Gated to owner/admin by the admin layout; tenant is the
 * session's org.
 */
export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    skipped?: string;
    import_error?: string;
  }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect("/me");
  if (!ctx.organizationId) redirect("/me");

  const graduates = await listSchoolGraduates(ctx.organizationId);
  const params = await searchParams;
  const importError = params.import_error;
  const created = params.created != null ? Number(params.created) : null;
  const updated = params.updated != null ? Number(params.updated) : null;
  const skipped = params.skipped != null ? Number(params.skipped) : null;
  const hasResult = created != null || updated != null || skipped != null;

  const claimedCount = graduates.filter((g) => g.claimed).length;

  return (
    <div className="stack" style={{ gap: "var(--space-6)" }}>
      <header>
        <span className="eyebrow">Roster</span>
        <h1 style={{ margin: "0 0 var(--space-2)" }}>Facilitators</h1>
        <p className="muted" style={{ margin: 0 }}>
          {graduates.length} on roster · {claimedCount} claimed. Invite
          graduates to claim their profile, or bulk-import a new cohort.
        </p>
      </header>

      {/* Import feedback */}
      {hasResult && (
        <div className="panel panel--accent">
          <strong>Import complete.</strong> {created ?? 0} created ·{" "}
          {updated ?? 0} updated · {skipped ?? 0} skipped (already claimed).
        </div>
      )}
      {importError && (
        <div className="panel">
          <p style={{ margin: 0 }}>
            <strong>Import failed.</strong> {importError}
          </p>
        </div>
      )}

      {/* Current roster table */}
      <section className="panel">
        <h2 style={{ fontSize: "var(--fs-h3)", marginTop: 0 }}>Current roster</h2>
        {graduates.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No facilitators yet. Use bulk import below to seed your cohort.
          </p>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Facilitator</th>
                  <th>Status</th>
                  <th>Claim</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {graduates.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <span style={{ fontWeight: 550 }}>{g.displayName}</span>
                      <span
                        className="muted"
                        style={{ display: "block", fontSize: "var(--fs-xs)" }}
                      >
                        {g.slug}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-verified">{g.status}</span>
                    </td>
                    <td>
                      <span
                        className={`badge ${g.claimed ? "badge-verified" : "badge-online"}`}
                      >
                        {g.claimed ? "claimed" : "unclaimed"}
                      </span>
                    </td>
                    <td>
                      {g.claimed ? (
                        <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>
                          —
                        </span>
                      ) : (
                        <form action={emitClaimLink} className={styles.tableActions}>
                          <input type="hidden" name="profileId" value={g.id} />
                          <input
                            className="input"
                            name="email"
                            type="email"
                            placeholder="email (optional)"
                            style={{ maxWidth: "13rem" }}
                          />
                          <button type="submit" className="btn btn-outline btn-sm">
                            Emit claim link
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="muted" style={{ fontSize: "var(--fs-xs)", margin: "var(--space-4) 0 0" }}>
          Emitting a claim link mints a single-use, 14-day token. The copyable
          link (and optional email status) appears on the Overview.
        </p>
      </section>

      {/* Bulk import */}
      <section className="panel">
        <h2 style={{ fontSize: "var(--fs-h3)", marginTop: 0 }}>Bulk import</h2>
        <p className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: 0 }}>
          Paste a JSON array or CSV (with a header row). Each row becomes an
          unclaimed draft profile; rows that already exist and are claimed are
          skipped. Only <code>displayName</code> is required — <code>slug</code>{" "}
          is derived from the name if omitted. Recognised fields:{" "}
          <code>slug, email, headline, bio, modalities, city, country, program, online, lat, lng</code>.
        </p>

        <details style={{ marginBottom: "var(--space-4)" }}>
          <summary style={{ cursor: "pointer", fontSize: "var(--fs-sm)", fontWeight: 550 }}>
            Show example formats
          </summary>
          <div className="stack" style={{ marginTop: "var(--space-3)" }}>
            <div>
              <p className="muted" style={{ fontSize: "var(--fs-xs)", margin: "0 0 var(--space-1)" }}>
                JSON
              </p>
              <pre className={styles.codeArea} style={{ minHeight: "auto" }}>
                {SAMPLE_JSON}
              </pre>
            </div>
            <div>
              <p className="muted" style={{ fontSize: "var(--fs-xs)", margin: "0 0 var(--space-1)" }}>
                CSV
              </p>
              <pre className={styles.codeArea} style={{ minHeight: "auto" }}>
                {SAMPLE_CSV}
              </pre>
            </div>
          </div>
        </details>

        <form action={bulkImportRoster} className="stack" style={{ gap: "var(--space-3)" }}>
          <textarea
            name="roster"
            className={styles.codeArea}
            placeholder="Paste JSON array or CSV rows here…"
            spellCheck={false}
            required
          />
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--space-2)",
              fontSize: "var(--fs-sm)",
            }}
          >
            <input type="checkbox" name="issueClaimLinks" value="1" />
            Mint claim links for new profiles (copy from the result, no email sent)
          </label>
          <div>
            <button type="submit" className="btn btn-primary">
              Import facilitators
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
