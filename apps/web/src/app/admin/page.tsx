import { billingConfigured, getSubscription } from "@directory/billing";
import {
  getOrganizationBranding,
  getSchoolMetrics,
  latestInsightDTO,
  listSchoolGraduates,
} from "@directory/core";
import { ArrowDownRight, ArrowUpRight, LayoutDashboard } from "lucide-react";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getAuthContext } from "../../lib/auth-session.ts";
import { InsightPanel } from "../insight-panel.tsx";
import { OnboardingChecklist } from "./_components/OnboardingChecklist.tsx";
import { PageHeader } from "./_components/PageHeader.tsx";
import { openPortal, startCheckout } from "./actions.ts";
import styles from "./admin-shell.module.css";
import { EvalQualityPanel } from "./eval-quality-panel.tsx";

/**
 * School admin Overview — the control-center landing. Leads with the AI insight
 * (the product's differentiator) and a row of KPI stat cards, with billing and
 * insight-quality in a right rail. Gated to owners/admins by the admin layout,
 * which also renders the nav + signed-in identity, so this page no longer
 * carries its own nav bar or settings/keys link row. The tenant is the
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
  const orgId = ctx.organizationId;

  // Trailing 30-day window for the headline metrics, plus the PRIOR 30-day
  // window so each KPI can show a change vs last period. Metrics degrade to
  // `null` (analytics unreachable) rather than taking down the overview — a
  // null window renders "no data yet", which is honest, instead of a fake 0.
  const now = new Date();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const twoMonthsAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [insight, sub, graduates, metrics, priorMetrics, branding] =
    await Promise.all([
      latestInsightDTO(orgId, "school", null),
      getSubscription(orgId),
      listSchoolGraduates(orgId),
      getSchoolMetrics(orgId, monthAgo, now).catch(() => null),
      getSchoolMetrics(orgId, twoMonthsAgo, monthAgo).catch(() => null),
      getOrganizationBranding(orgId).catch(() => null),
    ]);

  const params = await searchParams;
  const { checkout } = params;
  const active = sub?.status === "active" || sub?.status === "trialing";

  const total = graduates.length;
  const published = graduates.filter((g) => g.status === "published").length;
  // A school counts as "branded" once it sets any of logo / accent / hero copy.
  const branded = !!(branding?.logo || branding?.heroCopy || branding?.themeColor);

  // When analytics is unreachable `metrics` is null — surface that honestly as
  // "no data yet" instead of a misleading 0 over "last 30 days".
  const analyticsLive = metrics != null;
  const profileViews = metrics?.profile_views ?? null;
  // "Leads" = intent signals a school cares about (booking + contact clicks).
  const leads = analyticsLive
    ? (metrics?.booking_intent ?? 0) + (metrics?.contact_clicks ?? 0)
    : null;

  // Prior-window comparison values (only when both windows resolved).
  const priorProfileViews = priorMetrics?.profile_views ?? null;
  const priorLeads =
    priorMetrics != null
      ? (priorMetrics.booking_intent ?? 0) + (priorMetrics.contact_clicks ?? 0)
      : null;

  type Stat = {
    label: string;
    value: number | null;
    hint: string;
    prior?: number | null;
  };

  const stats: Stat[] = [
    { label: "Graduates", value: total, hint: `${published} published` },
    { label: "Published", value: published, hint: `of ${total} profiles` },
    {
      label: "Profile views",
      value: profileViews,
      hint: analyticsLive ? "last 30 days" : "no data yet",
      prior: priorProfileViews,
    },
    {
      label: "Leads",
      value: leads,
      hint: analyticsLive ? "bookings + contacts · 30d" : "no data yet",
      prior: priorLeads,
    },
  ];

  return (
    <div className="stack" style={{ gap: "var(--space-6)" }}>
      <PageHeader
        eyebrow="Overview"
        title="School dashboard"
        intro="Your graduates, reach, and AI coaching at a glance."
        icon={<LayoutDashboard size={22} />}
      />

      <OnboardingChecklist
        branded={branded}
        hasFacilitators={total > 0}
        hasPublished={published > 0}
        subscriptionActive={active}
      />

      {checkout === "success" && (
        <div className="flash flash-ok">
          <strong>Subscription started.</strong> Stripe is processing — status
          updates here once the webhook lands.
        </div>
      )}
      {checkout === "cancelled" && (
        <p className="muted" style={{ margin: 0 }}>Checkout cancelled.</p>
      )}

      <div className={styles.overviewGrid}>
        <div className={styles.overviewMain}>
          {/* AI insight — the hero. The differentiator leads the page. */}
          {insight ? (
            <InsightPanel insight={insight} />
          ) : (
            <section className="panel panel--accent">
              <h2 style={{ margin: 0, fontSize: "var(--fs-h2)" }}>
                AI insights &amp; coaching
              </h2>
              <p className="muted" style={{ margin: "var(--space-2) 0 0" }}>
                Insights generate automatically overnight — check back tomorrow.
              </p>
            </section>
          )}

          {/* KPI stat cards */}
          <div className={styles.statGrid}>
            {stats.map((s) => (
              <StatCard key={s.label} {...s} />
            ))}
          </div>

          {/* Quick actions */}
          <div className="panel">
            <h2 style={{ fontSize: "var(--fs-h3)", marginTop: 0 }}>Quick actions</h2>
            <div className={styles.quickActions}>
              <a className="btn btn-primary" href="/admin/roster">
                Add facilitators
              </a>
              <a className="btn btn-outline" href="/admin/developers">
                Connect an agent
              </a>
            </div>
          </div>
        </div>

        <div className={styles.overviewRail}>
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
              <span className={`badge ${active ? "badge-online" : "badge-neutral"}`}>
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
                <button type="submit" className="btn btn-outline">
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
      </div>
    </div>
  );
}

/**
 * One KPI tile. Renders an em dash for an unknown value (analytics unreachable)
 * and, when a prior-window count is available, a small ▲/▼ change pill so the
 * operator sees direction at a glance, not just a level.
 */
function StatCard({
  label,
  value,
  hint,
  prior,
}: {
  label: string;
  value: number | null;
  hint: string;
  prior?: number | null;
}) {
  const known = value != null;
  const delta = renderDelta(value, prior);
  return (
    <div className={`panel ${styles.stat}`}>
      <p className={styles.statLabel}>{label}</p>
      <div className={styles.statDeltaRow}>
        <p className={styles.statValue}>{known ? value.toLocaleString() : "—"}</p>
        {delta}
      </div>
      <p className={styles.statHint}>{hint}</p>
    </div>
  );
}

/** A ▲/▼/— change pill comparing the current window to the prior one. */
function renderDelta(value: number | null, prior?: number | null): ReactNode {
  if (value == null || prior == null) return null;
  const diff = value - prior;
  if (diff === 0) {
    return <span className={`${styles.statDelta} ${styles.statDeltaFlat}`}>±0</span>;
  }
  const up = diff > 0;
  const cls = up ? styles.statDeltaUp : styles.statDeltaDown;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`${styles.statDelta} ${cls}`}>
      <Icon size={12} aria-hidden />
      {Math.abs(diff).toLocaleString()}
    </span>
  );
}
