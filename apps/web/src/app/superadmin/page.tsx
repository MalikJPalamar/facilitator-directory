import { getPlatformStats, listAllSchools } from "@directory/core";
import {
  Bot,
  Building2,
  Eye,
  GraduationCap,
  MousePointerClick,
  Receipt,
  Search,
  UserPlus,
} from "lucide-react";
import { redirect } from "next/navigation";

import { getAuthContext, isSuperadmin } from "../../lib/auth-session.ts";
import { PageHeader } from "../admin/_components/PageHeader.tsx";
import { SuperadminBar } from "./_bar.tsx";
import { SchoolsList } from "./_schools.tsx";
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
      <SuperadminBar name={ctx.name} backHref="/" backLabel="← Home" />

      <PageHeader
        eyebrow="Platform"
        title="Platform overview"
        icon={<Building2 />}
        intro={
          <>
            Read-only. Platform totals and the trailing {stats.windowDays}-day
            activity across every tenant.
          </>
        }
      />

      {/* ---- Metrics band: platform totals ---- */}
      <div className={styles.statGrid} style={{ marginTop: "var(--space-6)" }}>
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

      {/* ---- Schools (client-side name/slug filter) ---- */}
      <SchoolsList schools={schools} />
    </div>
  );
}
