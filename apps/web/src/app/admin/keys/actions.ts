"use server";

import { ALL_SCOPES } from "@directory/contracts";
import { createApiKey, revokeApiKey } from "@directory/core";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../../lib/auth-session.ts";

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
 * Mint an org-scoped API key. The plaintext is returned via the URL ONCE (the
 * same reveal-once pattern as claim links) — it is never stored and can't be
 * recovered. Only the requested, known scopes are granted.
 */
export async function createKey(formData: FormData): Promise<void> {
  const { organizationId, userId } = await requireAdminOrg();
  const name = String(formData.get("name") ?? "").trim() || "Untitled key";
  const scopes = formData
    .getAll("scopes")
    .map(String)
    .filter((s) => (ALL_SCOPES as readonly string[]).includes(s));

  const { plaintext } = await createApiKey({
    organizationId,
    name,
    scopes,
    createdByUserId: userId,
  });
  redirect(`/admin/keys?new=${encodeURIComponent(plaintext)}`);
}

export async function revokeKey(formData: FormData): Promise<void> {
  const { organizationId } = await requireAdminOrg();
  await revokeApiKey(organizationId, String(formData.get("keyId") ?? ""));
  redirect("/admin/keys?revoked=1");
}
