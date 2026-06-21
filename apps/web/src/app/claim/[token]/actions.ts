"use server";

import { ClaimError, claimProfile } from "@directory/core";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../../lib/auth-session.ts";

/**
 * Claim the profile a token unlocks for the signed-in user, then send them to
 * their editor. Identity is resolved server-side; the token is the only
 * client-supplied input and is validated inside `claimProfile`.
 */
export async function claim(formData: FormData): Promise<void> {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const token = String(formData.get("token") ?? "");
  if (!token) redirect("/claim/invalid");

  try {
    await claimProfile({ token, userId: ctx.userId });
  } catch (err) {
    if (err instanceof ClaimError) {
      redirect(`/claim/${encodeURIComponent(token)}?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }

  redirect("/me/edit");
}
