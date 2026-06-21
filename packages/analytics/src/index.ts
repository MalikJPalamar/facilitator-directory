import { env } from "@directory/config";
import { db, tables } from "@directory/db";

/**
 * The analytics spine. Every interaction — human or agent — calls `capture`.
 * Writes the durable `analytics_event` row (ownable raw stream for the AI
 * insights loop, incentive engine, and future ads marketplace) and best-effort
 * mirrors to PostHog for product dashboards.
 */

export const EVENT_TYPES = [
  "profile_view",
  "search",
  "contact_click",
  "booking_intent",
  "agent_query",
  "profile_published",
  "lead_created",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export type CaptureInput = {
  organizationId: string;
  eventType: EventType;
  profileId?: string | null;
  /** 'human' (default) or 'agent' — first-class capture of agents-as-customers. */
  actor?: "human" | "agent";
  props?: Record<string, unknown>;
  sessionId?: string;
  correlationId?: string;
};

export async function capture(input: CaptureInput): Promise<void> {
  await db.insert(tables.analyticsEvent).values({
    organizationId: input.organizationId,
    profileId: input.profileId ?? null,
    eventType: input.eventType,
    actor: input.actor ?? "human",
    props: input.props ?? {},
    sessionId: input.sessionId,
    correlationId: input.correlationId,
  });

  // Best-effort PostHog mirror (group analytics). No-op without a key.
  if (env.POSTHOG_API_KEY) {
    void postHogCapture(input).catch(() => {
      /* analytics must never break the request path */
    });
  }
}

async function postHogCapture(input: CaptureInput): Promise<void> {
  await fetch(`${env.POSTHOG_HOST}/capture/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: env.POSTHOG_API_KEY,
      event: input.eventType,
      distinct_id: input.sessionId ?? input.profileId ?? "anon",
      properties: {
        ...input.props,
        actor: input.actor ?? "human",
        $groups: { school: input.organizationId },
        profile_id: input.profileId,
      },
    }),
  });
}
