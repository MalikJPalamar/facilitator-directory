"use server";

import {
  createCheckoutSession,
  createPortalLink,
  getSubscription,
} from "@directory/billing";
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
