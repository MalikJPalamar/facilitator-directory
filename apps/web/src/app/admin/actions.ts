"use server";

import {
  createCheckoutSession,
  createPortalLink,
  getSubscription,
} from "@directory/billing";
import {
  ClaimError,
  issueClaimToken,
  schoolNameForOrg,
  sendClaimInvite,
} from "@directory/core";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../lib/auth-session.ts";

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

async function requireAdminOrg(): Promise<{ organizationId: string; email: string }> {
  const ctx = await getAuthContext();
  if (!ctx?.organizationId || (ctx.role !== "owner" && ctx.role !== "admin")) {
    redirect("/login");
  }
  return { organizationId: ctx.organizationId, email: ctx.email };
}

/** Start a Stripe Checkout (test mode) for the school's subscription. */
export async function startCheckout(): Promise<void> {
  const { organizationId, email } = await requireAdminOrg();
  const base = await origin();
  const sub = await getSubscription(organizationId);
  const url = await createCheckoutSession({
    organizationId,
    seats: Math.max(1, sub?.seats ?? 1),
    successUrl: `${base}/admin?checkout=success`,
    cancelUrl: `${base}/admin?checkout=cancelled`,
    customerEmail: email,
  });
  redirect(url || "/admin?checkout=error");
}

/** Open the Stripe billing portal for an existing customer. */
export async function openPortal(): Promise<void> {
  const { organizationId } = await requireAdminOrg();
  const sub = await getSubscription(organizationId);
  if (!sub?.stripeCustomerId) redirect("/admin");
  const url = await createPortalLink(sub.stripeCustomerId, `${await origin()}/admin`);
  redirect(url);
}

/**
 * Mint a single-use claim link for one of the school's unclaimed graduate
 * profiles. Owner/admin only, tenant-checked. On success we hand the token back
 * through the URL so the page can render a copyable `/claim/<token>` link;
 * an already-claimed/missing profile (a `ClaimError`) surfaces as a soft error.
 */
export async function emitClaimLink(formData: FormData): Promise<void> {
  const { organizationId } = await requireAdminOrg();
  const profileId = String(formData.get("profileId") ?? "");
  const email = String(formData.get("email") ?? "").trim();

  let token: string;
  let emailParam = "";
  try {
    token = await issueClaimToken(profileId);
    if (email) {
      const claimUrl = `${await origin()}/claim/${token}`;
      const schoolName = await schoolNameForOrg(organizationId);
      const r = await sendClaimInvite({ to: email, schoolName, claimUrl });
      emailParam = r.sent
        ? "&emailed=1"
        : `&email_error=${encodeURIComponent((r.reason ?? "failed").slice(0, 80))}`;
    }
  } catch (err) {
    if (err instanceof ClaimError) redirect("/admin?claim_error=1");
    throw err;
  }
  // Outside the try: redirect() signals via a thrown NEXT_REDIRECT, which must
  // not be caught by the ClaimError handler above.
  redirect(`/admin?claim=${profileId}&token=${token}${emailParam}`);
}
