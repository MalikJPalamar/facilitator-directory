"use server";

import { ALL_SCOPES } from "@directory/contracts";
import { createApiKey, revokeApiKey } from "@directory/core";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../../lib/auth-session.ts";

/**
 * Owner/admin guard for the key actions. The Connect hub mints org-scoped Bearer
 * keys, so the same gate as the page applies; we surface the org + the minting
 * user so created keys carry attribution.
 */
async function requireAdminOrg(): Promise<{
  organizationId: string;
  userId: string;
}> {
  const ctx = await getAuthContext();
  if (!ctx?.organizationId || (ctx.role !== "owner" && ctx.role !== "admin")) {
    redirect("/login");
  }
  return { organizationId: ctx.organizationId, userId: ctx.userId };
}

/**
 * Mint an org-scoped API key from the Connect hub. The plaintext is returned via
 * the URL ONCE (the same reveal-once pattern as claim links) — it is never stored
 * and can't be recovered. Only the requested, known scopes are granted. We land
 * back on the #keys section so the reveal banner is in view.
 */
export async function createKey(formData: FormData): Promise<void> {
  const { organizationId, userId } = await requireAdminOrg();
  const name = String(formData.get("name") ?? "").trim() || "Untitled key";
  const scopes = formData
    .getAll("scopes")
    .map(String)
    .filter((s) => (ALL_SCOPES as readonly string[]).includes(s));

  // A key with zero scopes can't do anything — fall back to the public read
  // scope so minting always yields a usable key (the picker hints at this).
  if (scopes.length === 0) scopes.push("directory:read");

  const { plaintext } = await createApiKey({
    organizationId,
    name,
    scopes,
    createdByUserId: userId,
  });
  redirect(`/admin/developers?new=${encodeURIComponent(plaintext)}#keys`);
}

export async function revokeKey(formData: FormData): Promise<void> {
  const { organizationId } = await requireAdminOrg();
  await revokeApiKey(organizationId, String(formData.get("keyId") ?? ""));
  redirect("/admin/developers?revoked=1#keys");
}
