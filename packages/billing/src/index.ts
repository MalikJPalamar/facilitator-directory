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

/**
 * Whether Stripe checkout is configured with real-looking keys. Fails closed on
 * placeholder values (e.g. "sk_test_...") so the admin UI never renders a
 * checkout button that 500s against junk credentials.
 */
export function billingConfigured(): boolean {
  const secret = env.STRIPE_SECRET_KEY ?? "";
  const price = env.STRIPE_PRICE_ID ?? "";
  return (
    secret.startsWith("sk_") &&
    secret.length >= 20 &&
    price.startsWith("price_") &&
    price.length >= 15
  );
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
    // Propagate the tenant onto the subscription so later customer.subscription.*
    // webhook events (which don't carry session metadata) can resolve the org.
    subscription_data: { metadata: { organizationId: opts.organizationId } },
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
  if (env.STRIPE_WEBHOOK_SECRET) {
    // Verified path: always required when a signing secret is configured.
    if (!signature) throw new Error("missing stripe-signature header");
    event = stripe().webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } else if (env.NODE_ENV !== "production" && !env.STRIPE_SECRET_KEY) {
    // Local-dev escape hatch ONLY: no Stripe configured at all. In production —
    // or whenever Stripe IS wired — we FAIL CLOSED rather than trust unsigned
    // JSON, so a forged event can't mint/cancel a paid subscription.
    event = JSON.parse(rawBody) as Stripe.Event;
  } else {
    throw new Error(
      "STRIPE_WEBHOOK_SECRET is required to verify webhooks (refusing unsigned event)",
    );
  }

  // Idempotency: skip if we've already recorded this event id.
  const existing = await db
    .select({ id: tables.billingEvent.id })
    .from(tables.billingEvent)
    .where(eq(tables.billingEvent.stripeEventId, event.id))
    .limit(1);
  if (existing.length > 0) return { received: true };

  // Resolve the full Stripe subscription + customer for state-changing events.
  // customer.subscription.* events already carry the subscription object; a
  // checkout.session.completed carries only ids, so retrieve the subscription
  // to read period/seats/status.
  let sub: Stripe.Subscription | null = null;
  let customerId: string | null = null;
  if (event.type.startsWith("customer.subscription.")) {
    sub = event.data.object as Stripe.Subscription;
    customerId =
      typeof sub.customer === "string" ? sub.customer : (sub.customer?.id ?? null);
  } else if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    customerId =
      typeof session.customer === "string"
        ? session.customer
        : (session.customer?.id ?? null);
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    if (subId) sub = await stripe().subscriptions.retrieve(subId);
  }

  // Resolve the tenant: subscription metadata, then session metadata, then the
  // mirror keyed by Stripe subscription id (covers events with no metadata).
  const eventMeta = (
    event.data.object as { metadata?: { organizationId?: string } }
  ).metadata;
  let organizationId: string | null =
    (sub?.metadata?.organizationId as string | undefined) ??
    eventMeta?.organizationId ??
    null;
  if (!organizationId && sub?.id) {
    const [existing] = await db
      .select({ organizationId: tables.subscription.organizationId })
      .from(tables.subscription)
      .where(eq(tables.subscription.stripeSubscriptionId, sub.id))
      .limit(1);
    organizationId = existing?.organizationId ?? null;
  }

  await db.insert(tables.billingEvent).values({
    stripeEventId: event.id,
    type: event.type,
    organizationId,
    payload: event.data.object as unknown as Record<string, unknown>,
  });

  // Upsert the queryable mirror so the checkout->webhook->state loop closes for
  // ANY org, not just the seeded one — the row may not exist yet at first
  // checkout, in which case a bare UPDATE would silently hit zero rows.
  if (organizationId && sub) {
    const periodEnd = sub.current_period_end
      ? new Date(sub.current_period_end * 1000)
      : null;
    const seats = sub.items?.data?.[0]?.quantity;
    const fields = {
      status: sub.status,
      stripeCustomerId: customerId ?? undefined,
      stripeSubscriptionId: sub.id,
      ...(seats !== undefined ? { seats } : {}),
      ...(periodEnd ? { currentPeriodEnd: periodEnd } : {}),
      updatedAt: new Date(),
    };
    await db
      .insert(tables.subscription)
      .values({ organizationId, ...fields })
      .onConflictDoUpdate({
        target: tables.subscription.organizationId,
        set: fields,
      });
  }

  return { received: true };
}
