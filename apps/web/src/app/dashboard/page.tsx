import { redirect } from "next/navigation";

import { getAuthContext } from "../../lib/auth-session.ts";

/**
 * Post-login router: send school owners/admins to the school dashboard and
 * everyone else (graduates) to their own. Keeps `/login` from needing to know
 * the user's role.
 */
export default async function DashboardPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.role === "owner" || ctx.role === "admin") redirect("/admin");
  redirect("/me");
}
