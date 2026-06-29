import { billingConfigured, getSubscription } from "@directory/billing";
import { getSchoolMetrics, latestInsightDTO, listSchoolGraduates } from "@directory/core";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../lib/auth-session.ts";
import { InsightPanel } from "../insight-panel.tsx";
import { openPortal, startCheckout } from "./actions.ts";
import styles from "./admin-shell.module.css";
import { EvalQualityPanel } from "./eval-quality-panel.tsx";

/**
 * School admin Overview — the control-center landing. KPI stat cards
 * (graduates, published, 30d profile views, leads) + quick actions, then the
 * AI insight panel, billing/subscription status, and the insight-quality
 * widget. Gated to owners/admins by the admin layout, which also renders the
 * nav + signed-in identity, so this page no longer carries its own nav bar or
 * settings/keys link row. The tenant is the session's org, not a demo constant.
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
  const orgId = ctx.organizationId;

  // 30-day window for the headline metrics. Metrics degrade to zeros rather
  // than taking down the overview if the analytics table is unreachable.
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [insight, sub, graduates, metrics] = await Promise.all([
    latestInsightDTO(orgId, "school", null),
    getSubscription(orgId),
    listSchoolGraduates(orgId),
    getSchoolMetrics(orgId, monthAgo, now).catch(() => null),
  ]);

  const params = await searchParams;
  const { checkout } = params;
  const active = sub?.status === "active" || sub?.status === "trialing";

  const total = graduates.length;
  const published = graduates.filter((g) => g.status === "published").length;
  const profileViews = metrics?.profile_views ?? 0;
  // "Leads" = intent signals a school cares about (booking + contact clicks).
  const leads = (metrics?.booking_intent ?? 0) + (metrics?.contact_clicks ?? 0);

  const stats: { label: string; value: number; hint: string }[] = [
    { label: "Graduates", value: total, hint: `${published} published` },
    { label: "Published", value: published, hint: `of ${total} profiles` },
    { label: "Profile views", value: profileViews, hint: "last 30 days" },
    { label: "Leads", value: leads, hint: "bookings + contacts · 30d" },
  ];

  return (
    <div className="stack" style={{ gap: "var(--space-6)" }}>
      <header>
        <span className="eyebrow">Overview</span>
        <h1 style={{ margin: "0 0 var(--space-2)" }}>School dashboard</h1>
        <p className="muted" style={{ margin: 0 }}>
          Your graduates, reach, and AI coaching at a glance.
        </p>
      </header>

      {checkout === "success" && (
        <div className="panel panel--accent">
          <strong>Subscription started.</strong> Stripe is processing — status
          updates here once the webhook lands.
        </div>
      )}
      {checkout === "cancelled" && (
        <p className="muted" style={{ margin: 0 }}>Checkout cancelled.</p>
      )}

      {/* KPI stat cards */}
      <div className={styles.statGrid}>
        {stats.map((s) => (
          <div key={s.label} className={`panel ${styles.stat}`}>
            <p className={styles.statLabel}>{s.label}</p>
            <p className={styles.statValue}>{s.value.toLocaleString()}</p>
            <p className={styles.statHint}>{s.hint}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="panel">
        <h2 style={{ fontSize: "var(--fs-h3)", marginTop: 0 }}>Quick actions</h2>
        <div className={styles.quickActions}>
          <a className="btn btn-primary" href="/admin/roster">
            Add facilitators
          </a>
          <a className="btn btn-secondary" href="/admin/roster">
            Invite a graduate
          </a>
          <a className="btn btn-outline" href="/admin/developers">
            Connect an agent
          </a>
        </div>
      </div>

      {/* AI insight */}
      {insight ? (
        <InsightPanel insight={insight} />
      ) : (
        <div className="panel">
          <p style={{ margin: 0 }}>
            No school insight yet. Run <code>pnpm intelligence:nightly</code>.
          </p>
        </div>
      )}

      {/* Billing / subscription */}
      <div className="panel">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          <h2 style={{ fontSize: "var(--fs-h3)", margin: 0 }}>Billing</h2>
          <span className={`badge ${active ? "badge-online" : "badge-verified"}`}>
            {sub?.status ?? "no subscription"}
          </span>
        </div>
        <p className="muted" style={{ fontSize: "var(--fs-sm)" }}>
          {sub?.plan ?? "school_membership"} · {sub?.seats ?? 0} seats
          {sub?.currentPeriodEnd
            ? ` · renews ${new Date(sub.currentPeriodEnd).toLocaleDateString()}`
            : ""}
        </p>
        {!billingConfigured() ? (
          <p className="muted" style={{ fontSize: "var(--fs-sm)", margin: 0 }}>
            Billing isn&apos;t configured. Set <code>STRIPE_SECRET_KEY</code> +{" "}
            <code>STRIPE_PRICE_ID</code> (test mode) to enable checkout.
          </p>
        ) : sub?.stripeCustomerId ? (
          <form action={openPortal}>
            <button type="submit" className="btn btn-secondary">
              Manage billing
            </button>
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
  );
}
