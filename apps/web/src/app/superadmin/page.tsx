import { listAllSchools } from "@directory/core";
import { redirect } from "next/navigation";

import { getAuthContext, isSuperadmin } from "../../lib/auth-session.ts";
import { LogoutButton } from "../logout-button.tsx";

/**
 * Platform superadmin overview — a READ-ONLY, cross-tenant list of every school
 * with basic counts. This is the only place that intentionally crosses tenant
 * boundaries, so access is gated purely by the SUPERADMIN_EMAILS allow-list:
 * anyone not on it (signed in or not) is bounced to /dashboard. No mutations
 * live here.
 */
export default async function SuperadminPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!isSuperadmin(ctx)) redirect("/dashboard");

  const schools = await listAllSchools();
  const totals = schools.reduce(
    (acc, s) => {
      acc.members += s.memberCount;
      acc.graduates += s.graduateCount;
      if (s.subscriptionStatus === "active" || s.subscriptionStatus === "trialing") {
        acc.paying += 1;
      }
      return acc;
    },
    { members: 0, graduates: 0, paying: 0 },
  );

  return (
    <div className="page">
      <div className="page-bar">
        <a href="/">← Home</a>
        <span
          className="muted"
          style={{ fontSize: "var(--fs-sm)", display: "inline-flex", gap: "var(--space-3)", alignItems: "center" }}
        >
          {ctx.name} (superadmin) <LogoutButton />
        </span>
      </div>
      <h1>Platform overview</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Read-only. {schools.length} school{schools.length === 1 ? "" : "s"} ·{" "}
        {totals.members} member{totals.members === 1 ? "" : "s"} ·{" "}
        {totals.graduates} graduate{totals.graduates === 1 ? "" : "s"} ·{" "}
        {totals.paying} paying.
      </p>

      <div className="panel">
        {schools.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No schools yet.</p>
        ) : (
          <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {schools.map((s) => {
              const paying =
                s.subscriptionStatus === "active" || s.subscriptionStatus === "trialing";
              return (
                <li
                  key={s.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "var(--space-3)",
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ display: "inline-flex", flexDirection: "column" }}>
                    <a href={`/${s.slug}`}>{s.name}</a>
                    <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>
                      /{s.slug} · created {new Date(s.createdAt).toLocaleDateString()}
                    </span>
                  </span>
                  <span style={{ display: "inline-flex", gap: "var(--space-3)", alignItems: "center" }}>
                    <span className="muted" style={{ fontSize: "var(--fs-sm)" }}>
                      {s.memberCount} member{s.memberCount === 1 ? "" : "s"} ·{" "}
                      {s.graduateCount} grad{s.graduateCount === 1 ? "" : "s"}
                    </span>
                    <span className={`badge ${paying ? "badge-online" : "badge-verified"}`}>
                      {s.subscriptionStatus}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
