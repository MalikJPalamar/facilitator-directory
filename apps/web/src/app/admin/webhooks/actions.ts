"use server";

import { WEBHOOK_EVENTS, WebhookEndpointInput } from "@directory/contracts";
import {
  BlockedUrlError,
  createWebhookEndpoint,
  deleteWebhookEndpoint,
  rotateWebhookSecret,
  sendTestWebhook,
  setWebhookEndpointEnabled,
} from "@directory/core";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../../lib/auth-session.ts";

/**
 * CRM webhooks console — server actions. These own the webhook lifecycle for the
 * /admin/webhooks surface and are deliberately independent of the settings page
 * (which now only hosts branding). Every action is owner/admin-gated and
 * tenant-scoped to the session's org; the core functions enforce the org
 * boundary in their WHERE clauses, so a stale/forged endpointId can never touch
 * another school's row. `redirect()` always lives OUTSIDE any try block so its
 * thrown NEXT_REDIRECT isn't swallowed as an error.
 */
async function requireAdminOrg(): Promise<string> {
  const ctx = await getAuthContext();
  if (!ctx?.organizationId || (ctx.role !== "owner" && ctx.role !== "admin")) {
    redirect("/login");
  }
  return ctx.organizationId;
}

/**
 * Register a CRM webhook endpoint. The signing secret is returned via the URL
 * ONCE (reveal-once) so the admin can paste it into their CRM — it is hashed at
 * rest and can never be recovered. The "*" sentinel (an "all events" checkbox)
 * and an empty selection both mean "deliver every event"; otherwise we keep only
 * the known event names. A private/loopback/metadata target trips the core SSRF
 * guard (`BlockedUrlError`) and surfaces as a friendly "public https" message.
 */
export async function createWebhook(formData: FormData): Promise<void> {
  const organizationId = await requireAdminOrg();

  const selected = formData.getAll("events").map(String);
  // "*" (the "all events" box) collapses to [] — the core treats [] and ["*"]
  // identically as "all", and [] keeps the stored row tidy.
  const events = selected.includes("*")
    ? []
    : selected.filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e));

  const parsed = WebhookEndpointInput.safeParse({
    url: String(formData.get("url") ?? "").trim(),
    events,
    description: String(formData.get("description") ?? "").trim() || undefined,
  });
  if (!parsed.success) {
    redirect("/admin/webhooks?error=url");
  }

  let secret: string;
  try {
    ({ secret } = await createWebhookEndpoint({
      organizationId,
      url: parsed.data.url,
      events: parsed.data.events,
      description: parsed.data.description,
    }));
  } catch (err) {
    if (err instanceof BlockedUrlError) redirect("/admin/webhooks?error=blocked");
    throw err;
  }
  redirect(`/admin/webhooks?secret=${encodeURIComponent(secret)}`);
}

export async function toggleWebhook(formData: FormData): Promise<void> {
  const organizationId = await requireAdminOrg();
  await setWebhookEndpointEnabled(
    organizationId,
    String(formData.get("endpointId") ?? ""),
    String(formData.get("enabled") ?? "") === "true",
  );
  redirect("/admin/webhooks?saved=1");
}

export async function rotateWebhook(formData: FormData): Promise<void> {
  const organizationId = await requireAdminOrg();
  const secret = await rotateWebhookSecret(
    organizationId,
    String(formData.get("endpointId") ?? ""),
  );
  redirect(
    secret
      ? `/admin/webhooks?secret=${encodeURIComponent(secret)}`
      : "/admin/webhooks?error=rotate",
  );
}

export async function deleteWebhook(formData: FormData): Promise<void> {
  const organizationId = await requireAdminOrg();
  await deleteWebhookEndpoint(
    organizationId,
    String(formData.get("endpointId") ?? ""),
  );
  redirect("/admin/webhooks?saved=1");
}

/**
 * Fire a signed synthetic `directory.test` event at one endpoint so the admin
 * can confirm their CRM is wired up. The delivery is fired inline (not the
 * async fan-out path), so the result reflects the real HTTP outcome; the new row
 * also shows up in the deliveries log below.
 */
export async function sendTest(formData: FormData): Promise<void> {
  const organizationId = await requireAdminOrg();
  const endpointId = String(formData.get("endpointId") ?? "");
  const { ok } = await sendTestWebhook(organizationId, endpointId);
  // Carry the endpoint id back so the result renders inline next to its row.
  redirect(
    `/admin/webhooks?tested=${ok ? "ok" : "fail"}&ep=${encodeURIComponent(endpointId)}#deliveries`,
  );
}
