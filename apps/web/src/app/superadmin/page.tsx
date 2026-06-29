import { getPlatformStats, listAllSchools } from "@directory/core";
import {
  Bot,
  Building2,
  ChevronRight,
  Eye,
  GraduationCap,
  MousePointerClick,
  Receipt,
  Search,
  UserPlus,
} from "lucide-react";
import { redirect } from "next/navigation";

import { getAuthContext, isSuperadmin } from "../../lib/auth-session.ts";
import { LogoutButton } from "../logout-button.tsx";
import { Stat } from "./_stat.tsx";
import styles from "./superadmin.module.css";

/**
 * Platform superadmin console — a READ-ONLY, cross-tenant cockpit for the
 * operator: a metrics band (platform totals + trailing-window activity, with
 * the "agents as customers" signals lifted) over a rich list of every school,
 * each linking to a per-school drill-down. This is the only place that
 * intentionally crosses tenant boundaries, so access is gated purely by the
 * SUPERADMIN_EMAILS allow-list: anyone not on it (signed in or not) is bounced
 * (anon → /login, non-superadmin → /dashboard). No mutations live here.
 */
export default async function SuperadminPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!isSuperadmin(ctx)) redirect("/dashboard");

  const [stats, schools] = await Promise.all([
    getPlatformStats(),
    listAllSchools(),
  ]);

  return (
    <div className="page">
      <div className="page-bar">
        <a href="/">← Home</a>
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

      <span className="eyebrow">Platform console</span>
      <h1 style={{ marginTop: 0 }}>Operator overview</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Read-only. Platform totals and the trailing {stats.windowDays}-day
        activity across every tenant.
      </p>

      {/* ---- Metrics band: platform totals ---- */}
      <div className={styles.statGrid}>
        <Stat
          icon={Building2}
          label="Schools"
          value={stats.schools}
          hint={`${stats.payingSchools.toLocaleString()} paying`}
        />
        <Stat
          icon={GraduationCap}
          label="Facilitators"
          value={stats.graduates}
          hint={`${stats.publishedGraduates.toLocaleString()} published`}
        />
        <Stat
          icon={Receipt}
          label="Paying schools"
          value={stats.payingSchools}
          hint="active or trialing"
        />
        <Stat
          icon={UserPlus}
          label="Leads"
          value={stats.leads}
          hint="captured all-time"
        />
      </div>

      {/* ---- Metrics band: trailing-window activity ---- */}
      <div className={styles.sectionHead}>
        <h2>Activity</h2>
        <span className={styles.windowNote}>last {stats.windowDays} days</span>
      </div>
      <div className={styles.statGrid}>
        <Stat
          icon={Bot}
          label="Agent queries"
          value={stats.agentQueries}
          hint="agents as customers"
          lead
        />
        <Stat
          icon={Search}
          label="Searches"
          value={stats.searches}
          hint="directory + API"
          lead
        />
        <Stat icon={Eye} label="Profile views" value={stats.profileViews} />
        <Stat
          icon={MousePointerClick}
          label="Contact clicks"
          value={stats.contactClicks}
        />
      </div>

      {/* ---- Schools ---- */}
      <div className={styles.sectionHead}>
        <h2>Schools</h2>
        <span className="results-count" style={{ margin: 0 }}>
          {schools.length} total
        </span>
      </div>

      {schools.length === 0 ? (
        <div className="panel">
          <p className="muted" style={{ margin: 0 }}>
            No schools yet.
          </p>
        </div>
      ) : (
        <div className={styles.schoolGrid}>
          {schools.map((s) => {
            const paying =
              s.subscriptionStatus === "active" ||
              s.subscriptionStatus === "trialing";
            return (
              <a
                key={s.id}
                href={`/superadmin/${s.id}`}
                className={styles.schoolCard}
              >
                <span className={styles.schoolMain}>
                  <span className={styles.schoolName}>{s.name}</span>
                  <span className={styles.schoolSlug}>/{s.slug}</span>
                  <span className={styles.schoolMeta}>
                    {s.memberCount.toLocaleString()} member
                    {s.memberCount === 1 ? "" : "s"} ·{" "}
                    {s.graduateCount.toLocaleString()} grad
                    {s.graduateCount === 1 ? "" : "s"} · created{" "}
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </span>
                <span className={styles.schoolRight}>
                  <span
                    className={`badge ${paying ? "badge-online" : "pill-static"}`}
                  >
                    {s.subscriptionStatus ?? "none"}
                  </span>
                  <ChevronRight size={18} className={styles.chevron} aria-hidden />
                </span>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
