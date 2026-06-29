import { schoolNameForOrg } from "@directory/core";
import { redirect } from "next/navigation";

import { getAuthContext, isSuperadmin } from "../../lib/auth-session.ts";
import { LogoutButton } from "../logout-button.tsx";
import styles from "./admin-shell.module.css";
import { AdminNav, type AdminNavItem } from "./_nav/AdminNav.tsx";

/**
 * The school "control center" shell — wraps every /admin/* page. It owns the
 * single auth gate (owner/admin only) so each admin route inherits the guard,
 * and renders the dashboard chrome: a sticky sub-nav with the signed-in school
 * + role + logout, plus a generous max-width content container the child pages
 * render into. It nests INSIDE the global site header/footer from the root
 * layout, so it deliberately does NOT render a top-level site header.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect("/me");
  if (!ctx.organizationId) redirect("/me");

  // The school's display name for the brand slot — fall back to the user's name
  // if the org has no name set yet so the bar never renders blank.
  let schoolName = ctx.name;
  try {
    schoolName = (await schoolNameForOrg(ctx.organizationId)) || ctx.name;
  } catch {
    schoolName = ctx.name;
  }

  const navItems: AdminNavItem[] = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/developers", label: "Developers" },
    { href: "/admin/webhooks", label: "Webhooks" },
    { href: "/admin/roster", label: "Roster" },
    { href: "/admin/settings", label: "Branding" },
  ];
  if (isSuperadmin(ctx)) {
    navItems.push({ href: "/superadmin", label: "Superadmin", external: true });
  }

  return (
    <div className={styles.shell}>
      <div className={styles.bar}>
        <div className={styles.barInner}>
          <div className={styles.brand}>
            <span className={styles.brandName}>{schoolName}</span>
            <span className={styles.brandKicker}>Control center</span>
          </div>
          <div className={styles.identity}>
            <span>
              {ctx.name} · <span className={styles.role}>{ctx.role}</span>
            </span>
            <LogoutButton />
          </div>
        </div>
        <div className={styles.navRow}>
          <div className={styles.navRowInner}>
            <AdminNav items={navItems} />
          </div>
        </div>
      </div>

      <div className={styles.content}>{children}</div>
    </div>
  );
}
