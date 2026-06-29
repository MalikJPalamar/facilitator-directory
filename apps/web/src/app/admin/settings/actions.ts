"use server";

import { updateOrganizationBranding } from "@directory/core";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../../lib/auth-session.ts";

async function requireAdminOrg(): Promise<string> {
  const ctx = await getAuthContext();
  if (!ctx?.organizationId || (ctx.role !== "owner" && ctx.role !== "admin")) {
    redirect("/login");
  }
  return ctx.organizationId;
}

/**
 * Persist the signed-in school's branding. Owner/admin only, tenant-scoped to
 * the session's org. `redirect()` lives outside any try so its thrown
 * NEXT_REDIRECT isn't swallowed.
 *
 * (CRM webhook management used to live here too; it now has its own dedicated
 * console at /admin/webhooks — see that route's actions for the webhook
 * lifecycle.)
 */
export async function updateBranding(formData: FormData): Promise<void> {
  const organizationId = await requireAdminOrg();

  await updateOrganizationBranding(organizationId, {
    name: String(formData.get("name") ?? ""),
    logo: String(formData.get("logo") ?? ""),
    themeColor: String(formData.get("themeColor") ?? ""),
    heroCopy: String(formData.get("heroCopy") ?? ""),
  });

  redirect("/admin/settings?saved=1");
}
