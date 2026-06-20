import { env } from "@directory/config";
import { db, eq, tables } from "@directory/db";
import Stripe from "stripe";

/**
 * Stripe Billing wrapper. Schools subscribe (per-seat by graduate count). Stripe
 * is the source of truth; webhooks update the queryable `subscription` mirror and
 * append to `billing_event` (idempotent by Stripe event id). Connect/payouts to
 * graduates are reserved for a later phase.
 */
function stripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not configured");
  return new Stripe(env.STRIPE_SECRET_KEY);
}

export type SubscriptionView = {
  status: string;
  plan: string;
  seats: number;
  currentPeriodEnd: Date | null;
  stripeCustomerId: string | null;
};

/** The queryable subscription mirror for a school (Stripe is the source of truth). */
export async function getSubscription(
  organizationId: string,
): Promise<SubscriptionView | null> {
  const [row] = await db
    .select({
      status: tables.subscription.status,
      plan: tables.subscription.plan,
      seats: tables.subscription.seats,
      currentPeriodEnd: tables.subscription.currentPeriodEnd,
      stripeCustomerId: tables.subscription.stripeCustomerId,
    })
    .from(tables.subscription)
    .where(eq(tables.subscription.organizationId, organizationId))
    .limit(1);
  return row ?? null;
}

/** Whether Stripe checkout is configured (test or live keys present). */
export function billingConfigured(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID);
}

export async function createCheckoutSession(opts: {
  organizationId: string;
  seats: number;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}): Promise<string> {
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: env.STRIPE_PRICE_ID, quantity: opts.seats }],
    customer_email: opts.customerEmail,
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    automatic_tax: { enabled: true },
    metadata: { organizationId: opts.organizationId },
  });
  return session.url ?? "";
}

export async function createPortalLink(
  customerId: string,
  returnUrl: string,
): Promise<string> {
  const session = await stripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
  return session.url;
}

/**
 * Handle an incoming Stripe webhook. Verifies the signature when a secret is
 * configured; records the event idempotently and syncs the subscription mirror.
 */
export async function handleWebhook(
  rawBody: string,
  signature: string | undefined,
): Promise<{ received: true }> {
  let event: Stripe.Event;
  if (env.STRIPE_WEBHOOK_SECRET && signature) {
    event = stripe().webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } else {
    event = JSON.parse(rawBody) as Stripe.Event;
  }

  // Idempotency: skip if we've already recorded this event id.
  const existing = await db
    .select({ id: tables.billingEvent.id })
    .from(tables.billingEvent)
    .where(eq(tables.billingEvent.stripeEventId, event.id))
    .limit(1);
  if (existing.length > 0) return { received: true };

  const organizationId =
    (event.data.object as { metadata?: { organizationId?: string } }).metadata
      ?.organizationId ?? null;

  await db.insert(tables.billingEvent).values({
    stripeEventId: event.id,
    type: event.type,
    organizationId,
    payload: event.data.object as unknown as Record<string, unknown>,
  });

  if (
    organizationId &&
    (event.type === "checkout.session.completed" ||
      event.type.startsWith("customer.subscription."))
  ) {
    const obj = event.data.object as {
      customer?: string;
      subscription?: string;
      status?: string;
    };
    await db
      .update(tables.subscription)
      .set({
        status: obj.status ?? "active",
        stripeCustomerId: obj.customer ?? undefined,
        stripeSubscriptionId: obj.subscription ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(tables.subscription.organizationId, organizationId));
  }

  return { received: true };
}
