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
    <main>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ margin: 0 }}><a href="/">← Home</a></p>
        <span style={{ fontSize: ".85rem", color: "#5a6b6f" }}>
          {ctx.name} ({ctx.role}) <LogoutButton />
        </span>
      </div>
      <h1>School admin</h1>
      {insight ? (
        <InsightPanel insight={insight} />
      ) : (
        <p>No school insight yet. Run <code>pnpm intelligence:nightly</code>.</p>
      )}
      <p style={{ marginTop: 24, color: "#5a6b6f", fontSize: ".9rem" }}>
        Members, certification verification, and the Stripe billing portal link
        mount here (minimal in this scaffold).
      </p>
    </main>
  );
}
