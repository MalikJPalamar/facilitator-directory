import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { organization } from "./auth.ts";

/**
 * Queryable mirror of the school's Stripe subscription. Stripe is the source of
 * truth; this cache is updated by webhooks. Seats == graduate members.
 */
export const subscription = pgTable("subscription", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organization.id, { onDelete: "cascade" })
    .unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  plan: text("plan").notNull().default("school_membership"),
  // trialing | active | past_due | canceled
  status: text("status").notNull().default("trialing"),
  seats: integer("seats").notNull().default(0),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: timestamp("cancel_at_period_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/** Append-only log of Stripe webhook deliveries (idempotent by Stripe event id). */
export const billingEvent = pgTable("billing_event", {
  id: uuid("id").primaryKey().defaultRandom(),
  stripeEventId: text("stripe_event_id").notNull().unique(),
  type: text("type").notNull(),
  organizationId: text("organization_id").references(() => organization.id, {
    onDelete: "set null",
  }),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
