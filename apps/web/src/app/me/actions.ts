"use server";

import { updateProfile } from "@directory/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthContext, graduateProfileIdFor } from "../../lib/auth-session.ts";

/**
 * Save the signed-in graduate's own profile. Re-resolves identity server-side
 * (never trusts a client-supplied profile id) so a user can only edit the
 * profile their membership owns.
 */
export async function saveProfile(formData: FormData): Promise<void> {
  const ctx = await getAuthContext();
  if (!ctx?.organizationId) redirect("/login");

  const profileId = await graduateProfileIdFor(ctx);
  if (!profileId) redirect("/me");

  const str = (k: string) => String(formData.get(k) ?? "").trim();

  const links: Record<string, string> = {};
  if (str("website")) links.website = str("website");
  if (str("instagram")) links.instagram = str("instagram");

  await updateProfile(ctx.organizationId, profileId, {
    headline: str("headline") || undefined,
    bio: str("bio") || undefined,
    acceptingClients: formData.get("acceptingClients") === "on",
    links,
  });

  revalidatePath("/me");
  redirect("/me");
}
