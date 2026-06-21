import { billingConfigured, getSubscription } from "@directory/billing";
import { latestInsightDTO, listSchoolGraduates } from "@directory/core";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../lib/auth-session.ts";
import { InsightPanel } from "../insight-panel.tsx";
import { LogoutButton } from "../logout-button.tsx";
import { emitClaimLink, openPortal, startCheckout } from "./actions.ts";
import { EvalQualityPanel } from "./eval-quality-panel.tsx";

/**
 * School admin dashboard — school-level AI insights + billing. Gated to
 * owners/admins of the signed-in user's organization; the tenant is the
 * session's org, not a demo constant.
 */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    checkout?: string;
    claim?: string;
    token?: string;
    claim_error?: string;
    emailed?: string;
    email_error?: string;
  }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect("/me");
  if (!ctx.organizationId) redirect("/me");

  const [insight, sub, graduates] = await Promise.all([
    latestInsightDTO(ctx.organizationId, "school", null),
    getSubscription(ctx.organizationId),
    listSchoolGraduates(ctx.organizationId),
  ]);
  const params = await searchParams;
  const { checkout, token } = params;
  const claimError = params.claim_error;
  const emailed = params.emailed;
  const emailError = params.email_error;
  const active = sub?.status === "active" || sub?.status === "trialing";

  // Same origin derivation as actions.ts so the emitted /claim/<token> link is
  // absolute and copyable (works behind the proxy's x-forwarded-* headers).
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${
    h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  }`;

  return (
    <div className="page">
      <div className="page-bar">
        <a href="/">← Home</a>
        <span className="muted" style={{ fontSize: "var(--fs-sm)", display: "inline-flex", gap: "var(--space-3)", alignItems: "center" }}>
          {ctx.name} ({ctx.role}) <LogoutButton />
        </span>
      </div>
      <h1>School admin</h1>
      <p style={{ marginTop: 0, display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <a className="btn btn-outline" href="/admin/settings">School settings</a>
        <a className="btn btn-outline" href="/admin/keys">API keys</a>
      </p>

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

        <section className="panel">
          <h2 style={{ fontSize: "var(--fs-h3)", marginTop: 0 }}>
            Graduates &amp; claim links
          </h2>

          {token && (
            <div className="panel panel--accent" style={{ marginBottom: "var(--space-4)" }}>
              <p style={{ margin: "0 0 var(--space-2)" }}>
                <strong>Claim link ready.</strong> Send this to the graduate —
                single-use, expires in 14 days.
              </p>
              <code
                style={{
                  display: "block",
                  wordBreak: "break-all",
                  fontSize: "var(--fs-sm)",
                }}
              >
                {origin}/claim/{token}
              </code>
              {emailed && (
                <p className="muted" style={{ fontSize: "var(--fs-sm)", margin: "var(--space-2) 0 0" }}>
                  Invite emailed.
                </p>
              )}
              {emailError && (
                <p className="muted" style={{ fontSize: "var(--fs-sm)", margin: "var(--space-2) 0 0" }}>
                  {emailError === "email not configured (set RESEND_API_KEY + EMAIL_FROM)"
                    ? "Email not configured — copy the link above instead."
                    : `Email not sent: ${emailError}`}
                </p>
              )}
            </div>
          )}

          {claimError && (
            <p className="muted" style={{ marginTop: 0 }}>
              That profile is already claimed.
            </p>
          )}

          {graduates.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No graduate profiles yet.
            </p>
          ) : (
            <ul className="stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {graduates.map((g) => (
                <li
                  key={g.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "var(--space-3)",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-3)" }}>
                    {g.displayName}
                    <span className={`badge ${g.claimed ? "badge-verified" : "badge-online"}`}>
                      {g.claimed ? "claimed" : "unclaimed"}
                    </span>
                  </span>
                  {!g.claimed && (
                    <form
                      action={emitClaimLink}
                      style={{ display: "inline-flex", gap: "var(--space-2)", alignItems: "center" }}
                    >
                      <input type="hidden" name="profileId" value={g.id} />
                      <input
                        className="input"
                        name="email"
                        type="email"
                        placeholder="facilitator email (optional)"
                      />
                      <button type="submit" className="btn btn-outline">
                        Emit claim link
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
