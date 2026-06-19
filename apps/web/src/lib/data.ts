import { capture } from "@directory/analytics";

/**
 * Server-side data access for the web app.
 *
 * The web app and the REST API run in the *same* deployment, so server
 * components call the domain layer (`@directory/core`) directly instead of
 * making an HTTP round-trip to their own origin. That round-trip went through
 * the public edge — which, behind Vercel Deployment Protection, returns 401 to
 * the server's self-fetch and made every page render "not found". Direct calls
 * are also one less hop and need no base-URL guessing. The HTTP API remains the
 * contract for *external* callers (other origins, agents); it just isn't how we
 * talk to ourselves.
 */

/** The seed school's org id — stands in for the OAuth claim in the demo dashboards. */
export const DEMO_ORG_ID = process.env.DEMO_ORG_ID ?? "org_breathwork_global";

/**
 * Public origin for canonical/structured-data URLs (no `/api` suffix).
 * Prefers an explicit site URL, then the stable Vercel production domain.
 */
export const SITE_BASE =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

/** Fire-and-forget analytics — never let an event write block or break a render. */
export function track(input: Parameters<typeof capture>[0]): void {
  void capture(input).catch(() => {});
}
