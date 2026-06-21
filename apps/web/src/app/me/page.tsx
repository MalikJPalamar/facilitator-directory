import { latestInsightDTO } from "@directory/core";
import { redirect } from "next/navigation";

import { getAuthContext, graduateProfileIdFor } from "../../lib/auth-session.ts";
import { InsightPanel } from "../insight-panel.tsx";
import { LogoutButton } from "../logout-button.tsx";

/**
 * Graduate dashboard — tenant-scoped to the signed-in user. Org + profile come
 * from the authenticated session (resolved via the user's membership), not a
 * demo header.
 */
export default async function MePage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const profileId = ctx.organizationId ? await graduateProfileIdFor(ctx) : null;
  const insight =
    ctx.organizationId && profileId
      ? await latestInsightDTO(ctx.organizationId, "graduate", profileId)
      : null;

  return (
    <div className="page">
      <div className="page-bar">
        <a href="/breathwork-global">← Directory</a>
        <span className="muted" style={{ fontSize: "var(--fs-sm)", display: "inline-flex", gap: "var(--space-3)", alignItems: "center" }}>
          {ctx.name} <LogoutButton />
        </span>
      </div>
      <div className="page-bar" style={{ marginBottom: "var(--space-4)" }}>
        <h1 style={{ margin: 0 }}>Your performance</h1>
        {profileId && <a className="btn btn-outline" href="/me/edit">Edit profile</a>}
      </div>
      {!profileId ? (
        <div className="panel">
          <p style={{ marginTop: 0 }}>
            This account isn&apos;t linked to a practitioner profile yet.
          </p>
          <p className="muted" style={{ marginBottom: 0 }}>
            Your school creates your profile and sends you a one-time claim link
            (it looks like <code>/claim/…</code>). Open that link while signed in
            to claim your profile — then you can edit it and your AI insights
            appear here.
          </p>
        </div>
      ) : insight ? (
        <InsightPanel insight={insight} />
      ) : (
        <div className="panel"><p style={{ margin: 0 }}>No insight yet. Run <code>pnpm intelligence:nightly</code>.</p></div>
      )}
    </div>
  );
}
