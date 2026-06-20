import { latestInsightDTO } from "@directory/core";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../lib/auth-session.ts";
import { InsightPanel } from "../insight-panel.tsx";
import { LogoutButton } from "../logout-button.tsx";

/**
 * School admin dashboard — school-level AI insights + billing link. Gated to
 * owners/admins of the signed-in user's organization; the tenant is the
 * session's org, not a demo constant.
 */
export default async function AdminPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect("/me");
  if (!ctx.organizationId) redirect("/me");

  const insight = await latestInsightDTO(ctx.organizationId, "school", null);

  return (
    <div className="page">
      <div className="page-bar">
        <a href="/">← Home</a>
        <span className="muted" style={{ fontSize: "var(--fs-sm)", display: "inline-flex", gap: "var(--space-3)", alignItems: "center" }}>
          {ctx.name} ({ctx.role}) <LogoutButton />
        </span>
      </div>
      <h1>School admin</h1>
      {insight ? (
        <InsightPanel insight={insight} />
      ) : (
        <div className="panel"><p style={{ margin: 0 }}>No school insight yet. Run <code>pnpm intelligence:nightly</code>.</p></div>
      )}
      <p className="muted" style={{ marginTop: "var(--space-5)", fontSize: "var(--fs-sm)" }}>
        Members, certification verification, and the Stripe billing portal link
        mount here (minimal in this scaffold).
      </p>
    </div>
  );
}
