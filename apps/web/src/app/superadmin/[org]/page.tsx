import { getSchoolDetail } from "@directory/core";
import {
  ArrowLeft,
  Bot,
  CalendarDays,
  CreditCard,
  ExternalLink,
  Eye,
  GraduationCap,
  KeyRound,
  Search,
  UserPlus,
  Users,
  Webhook,
} from "lucide-react";
import { redirect } from "next/navigation";

import { getAuthContext, isSuperadmin } from "../../../lib/auth-session.ts";
import { LogoutButton } from "../../logout-button.tsx";
import { MiniStat } from "../_stat.tsx";
import styles from "../superadmin.module.css";

/**
 * Per-school drill-down for the superadmin console (read-only, cross-tenant —
 * same SUPERADMIN_EMAILS gate as the index, re-checked here). Shows the
 * school's identity + subscription, its members, content/integration counts,
 * and trailing-window activity. A missing org renders a calm "not found".
 */
export default async function SuperadminSchoolPage({
  params,
}: {
  params: Promise<{ org: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!isSuperadmin(ctx)) redirect("/dashboard");

  const { org } = await params;
  const school = await getSchoolDetail(org);

  if (!school) {
    return (
      <div className="page">
        <div className="page-bar">
          <a href="/superadmin">← Console</a>
          <span
            className="muted"
            style={{
              fontSize: "var(--fs-sm)",
              display: "inline-flex",
              gap: "var(--space-3)",
              alignItems: "center",
            }}
          >
            {ctx.name} (superadmin) <LogoutButton />
          </span>
        </div>
        <h1>School not found</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          No school exists for <code>{org}</code> — it may have been deleted.
        </p>
        <a className="btn btn-outline" href="/superadmin">
          <ArrowLeft size={16} aria-hidden /> Back to console
        </a>
      </div>
    );
  }

  const sub = school.subscription;
  const paying = sub?.status === "active" || sub?.status === "trialing";

  return (
    <div className="page">
      <div className="page-bar">
        <a href="/superadmin">← Console</a>
        <span
          className="muted"
          style={{
            fontSize: "var(--fs-sm)",
            display: "inline-flex",
            gap: "var(--space-3)",
            alignItems: "center",
          }}
        >
          {ctx.name} (superadmin) <LogoutButton />
        </span>
      </div>

      {/* ---- Header ---- */}
      <span className="eyebrow">School</span>
      <h1 style={{ marginTop: 0, marginBottom: "var(--space-2)" }}>
        {school.themeColor ? (
          <span
            className={styles.swatch}
            style={{
              background: school.themeColor,
              marginRight: "var(--space-3)",
              verticalAlign: "middle",
            }}
            aria-hidden
          />
        ) : null}
        {school.name}
      </h1>
      <p className="muted" style={{ marginTop: 0 }}>
        <a className={styles.slugLink} href={`/${school.slug}`}>
          /{school.slug} <ExternalLink size={13} aria-hidden />
        </a>{" "}
        · created {new Date(school.createdAt).toLocaleDateString()}
      </p>

      <div className={styles.detailGrid}>
        {/* ---- Left column: members + counts ---- */}
        <div className="stack">
          <section className="panel">
            <div className={styles.sectionHead} style={{ margin: "0 0 var(--space-3)" }}>
              <h2>
                <Users
                  size={17}
                  aria-hidden
                  style={{ verticalAlign: "-2px", marginRight: 6 }}
                />
                Members
              </h2>
              <span className="results-count" style={{ margin: 0 }}>
                {school.members.length}
              </span>
            </div>
            {school.members.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No members.
              </p>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {school.members.map((m) => (
                    <tr key={m.id}>
                      <td>{m.name}</td>
                      <td className={styles.email}>{m.email}</td>
                      <td>
                        <span className={styles.roleTag}>{m.role}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="panel">
            <h2 style={{ fontSize: "var(--fs-h3)", marginTop: 0 }}>Content &amp; integrations</h2>
            <div>
              <div className={styles.kv}>
                <span className={styles.kvKey}>
                  <GraduationCap aria-hidden /> Facilitators
                </span>
                <span className={styles.kvVal}>
                  {school.publishedCount.toLocaleString()} published /{" "}
                  {school.graduateCount.toLocaleString()} total
                </span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvKey}>
                  <KeyRound aria-hidden /> API keys
                </span>
                <span className={styles.kvVal}>
                  {school.apiKeyCount.toLocaleString()}
                </span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvKey}>
                  <Webhook aria-hidden /> Webhooks
                </span>
                <span className={styles.kvVal}>
                  {school.webhookCount.toLocaleString()}
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* ---- Right column: subscription ---- */}
        <section className="panel">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "var(--space-3)",
              marginBottom: "var(--space-3)",
            }}
          >
            <h2 style={{ fontSize: "var(--fs-h3)", margin: 0 }}>
              <CreditCard
                size={17}
                aria-hidden
                style={{ verticalAlign: "-2px", marginRight: 6 }}
              />
              Subscription
            </h2>
            <span className={`badge ${paying ? "badge-online" : "pill-static"}`}>
              {sub?.status ?? "none"}
            </span>
          </div>
          {sub ? (
            <div>
              <div className={styles.kv}>
                <span className={styles.kvKey}>Plan</span>
                <span className={styles.kvVal}>{sub.plan}</span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvKey}>Seats</span>
                <span className={styles.kvVal}>{sub.seats.toLocaleString()}</span>
              </div>
              <div className={styles.kv}>
                <span className={styles.kvKey}>
                  <CalendarDays aria-hidden /> Renews
                </span>
                <span className={styles.kvVal}>
                  {sub.currentPeriodEnd
                    ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                    : "—"}
                </span>
              </div>
            </div>
          ) : (
            <p className="muted" style={{ margin: 0, fontSize: "var(--fs-sm)" }}>
              No subscription on record.
            </p>
          )}
        </section>
      </div>

      {/* ---- Recent activity ---- */}
      <div className={styles.sectionHead}>
        <h2>Activity</h2>
        <span className={styles.windowNote}>last {school.recent.windowDays} days</span>
      </div>
      <div className={styles.miniGrid}>
        <MiniStat icon={Bot} label="Agent queries" value={school.recent.agentQueries} />
        <MiniStat icon={Search} label="Searches" value={school.recent.searches} />
        <MiniStat icon={Eye} label="Profile views" value={school.recent.profileViews} />
        <MiniStat icon={UserPlus} label="Leads" value={school.recent.leads} />
      </div>
    </div>
  );
}
