"use server";

import { ProfileUpdate } from "@directory/contracts";
import { updateProfile } from "@directory/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAuthContext, graduateProfileIdFor } from "../../lib/auth-session.ts";

/**
 * Save the signed-in graduate's own profile. Re-resolves identity server-side
 * (never trusts a client-supplied profile id) so a user can only edit the
 * profile their membership owns, then validates the patch against the shared
 * contract before persisting.
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

  const statusRaw = str("status");

  const parsed = ProfileUpdate.safeParse({
    headline: str("headline") || undefined,
    bio: str("bio") || undefined,
    acceptingClients: formData.get("acceptingClients") === "on",
    links,
    status: statusRaw || undefined,
  });

  if (!parsed.success) {
    // Surface the first issue back on the edit form; keep the user's place.
    const msg = parsed.error.issues[0]?.message ?? "Invalid input";
    redirect(`/me/edit?error=${encodeURIComponent(msg)}`);
  }

  await updateProfile(ctx.organizationId, profileId, parsed.data);

  revalidatePath("/me");
  redirect("/me");
}
