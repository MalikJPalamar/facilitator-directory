import { billingConfigured, getSubscription } from "@directory/billing";
import { latestInsightDTO } from "@directory/core";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../lib/auth-session.ts";
import { InsightPanel } from "../insight-panel.tsx";
import { LogoutButton } from "../logout-button.tsx";
import { openPortal, startCheckout } from "./actions.ts";
import { EvalQualityPanel } from "./eval-quality-panel.tsx";

/**
 * School admin dashboard — school-level AI insights + billing. Gated to
 * owners/admins of the signed-in user's organization; the tenant is the
 * session's org, not a demo constant.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect("/me");
  if (!ctx.organizationId) redirect("/me");

  const [insight, sub] = await Promise.all([
    latestInsightDTO(ctx.organizationId, "school", null),
    getSubscription(ctx.organizationId),
  ]);
  const checkout = (await searchParams).checkout;
  const active = sub?.status === "active" || sub?.status === "trialing";

  return (
    <div className="page">
      <div className="page-bar">
        <a href="/">← Home</a>
        <span className="muted" style={{ fontSize: "var(--fs-sm)", display: "inline-flex", gap: "var(--space-3)", alignItems: "center" }}>
          {ctx.name} ({ctx.role}) <LogoutButton />
        </span>
      </div>
      <h1>School admin</h1>

      {checkout === "success" && (
        <div className="panel panel--accent" style={{ marginBottom: "var(--space-4)" }}>
          <strong>Subscription started.</strong> Stripe is processing — status updates here once the webhook lands.
        </div>
      )}
      {checkout === "cancelled" && (
        <p className="muted" style={{ marginTop: 0 }}>Checkout cancelled.</p>
      )}

      <div className="stack">
        {insight ? (
          <InsightPanel insight={insight} />
        ) : (
          <div className="panel"><p style={{ margin: 0 }}>No school insight yet. Run <code>pnpm intelligence:nightly</code>.</p></div>
        )}

        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-3)" }}>
            <h2 style={{ fontSize: "var(--fs-h3)", margin: 0 }}>Billing</h2>
            <span className={`badge ${active ? "badge-online" : "badge-verified"}`}>
              {sub?.status ?? "no subscription"}
            </span>
          </div>
          <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>
            {sub?.plan ?? "school_membership"} · {sub?.seats ?? 0} seats
            {sub?.currentPeriodEnd ? ` · renews ${new Date(sub.currentPeriodEnd).toLocaleDateString()}` : ""}
          </p>
          {!billingConfigured() ? (
            <p className="muted" style={{ fontSize: "var(--fs-sm)", margin: 0 }}>
              Billing isn&apos;t configured. Set <code>STRIPE_SECRET_KEY</code> + <code>STRIPE_PRICE_ID</code> (test mode) to enable checkout.
            </p>
          ) : sub?.stripeCustomerId ? (
            <form action={openPortal}>
              <button type="submit" className="btn btn-secondary">Manage billing</button>
            </form>
          ) : (
            <form action={startCheckout}>
              <button type="submit" className="btn btn-primary">
                {active ? "Update subscription" : "Start subscription"}
              </button>
            </form>
          )}
        </div>

        <EvalQualityPanel />
      </div>
    </div>
  );
}
