"use server";

import { WEBHOOK_EVENTS, WebhookEndpointInput } from "@directory/contracts";
import {
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  rotateWebhookSecret,
  setWebhookEndpointEnabled,
  updateOrganizationBranding,
} from "@directory/core";
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

/**
 * Register a CRM webhook endpoint. The signing secret is returned via the URL
 * ONCE (reveal-once) so the admin can paste it into their CRM. An empty event
 * selection means "all events".
 */
export async function createWebhook(formData: FormData): Promise<void> {
  const organizationId = await requireAdminOrg();
  const parsed = WebhookEndpointInput.safeParse({
    url: String(formData.get("url") ?? ""),
    events: formData
      .getAll("events")
      .map(String)
      .filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e)),
    description: String(formData.get("description") ?? "") || undefined,
  });
  if (!parsed.success) {
    redirect("/admin/settings?webhook_error=1");
  } else {
    const { secret } = await createWebhookEndpoint({
      organizationId,
      url: parsed.data.url,
      events: parsed.data.events,
      description: parsed.data.description,
    });
    redirect(`/admin/settings?webhook_secret=${encodeURIComponent(secret)}`);
  }
}

export async function toggleWebhook(formData: FormData): Promise<void> {
  const organizationId = await requireAdminOrg();
  await setWebhookEndpointEnabled(
    organizationId,
    String(formData.get("endpointId") ?? ""),
    String(formData.get("enabled") ?? "") === "true",
  );
  redirect("/admin/settings?webhook_saved=1");
}

export async function rotateWebhook(formData: FormData): Promise<void> {
  const organizationId = await requireAdminOrg();
  const secret = await rotateWebhookSecret(
    organizationId,
    String(formData.get("endpointId") ?? ""),
  );
  redirect(
    secret
      ? `/admin/settings?webhook_secret=${encodeURIComponent(secret)}`
      : "/admin/settings?webhook_error=1",
  );
}

export async function deleteWebhook(formData: FormData): Promise<void> {
  const organizationId = await requireAdminOrg();
  await deleteWebhookEndpoint(
    organizationId,
    String(formData.get("endpointId") ?? ""),
  );
  redirect("/admin/settings?webhook_saved=1");
}
