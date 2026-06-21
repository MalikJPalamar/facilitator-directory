import { capture } from "@directory/analytics";
import { auth } from "@directory/auth";
import { handleWebhook } from "@directory/billing";
import { env } from "@directory/config";
import {
  profileToJsonLd,
  SearchQuery,
  wellKnownAffordance,
} from "@directory/contracts";
import {
  getProfileDetail,
  getSchoolBySlug,
  latestInsightDTO,
  runNightly,
  searchDirectory,
} from "@directory/core";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { openApiDocument } from "./openapi.ts";

/**
 * The REST API as a framework-agnostic Hono app, based at `/api` so it can be
 * mounted either as a standalone Node server (apps/api/src/index.ts, for
 * Render/local) OR inside the Next.js app as a catch-all route handler
 * (apps/web app/api/[[...route]]/route.ts, for the single-Vercel deploy).
 * The integration contract base URL is therefore `<origin>/api`.
 */
export const app = new Hono().basePath("/api");
app.use("*", cors());

/**
 * Better Auth — identity + the organization (tenant) plugin. Mounted here so the
 * single Vercel deploy serves auth at `<origin>/api/auth/*` (Better Auth's
 * default basePath). The handler gets the raw Web Request; cookies + sessions
 * flow through the same origin as the app, so no cross-site config is needed.
 */
app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));

/**
 * Public origin of the current request, honouring the proxy headers Vercel sets,
 * so machine-discovery docs advertise the real deployment URL instead of the
 * server's own env defaults (which were `http://localhost:8787` in prod).
 */
function originOf(c: { req: { url: string; header: (k: string) => string | undefined } }): string {
  const host = c.req.header("x-forwarded-host") ?? c.req.header("host");
  if (host) {
    const proto = c.req.header("x-forwarded-proto") ?? new URL(c.req.url).protocol.replace(":", "");
    return `${proto}://${host}`;
  }
  return new URL(c.req.url).origin;
}

/**
 * SCAFFOLD AUTH. The validated OAuth token's org-context + scope claims are
 * stood in for by `x-org-id` / `x-graduate-profile-id` headers here. In
 * production this middleware validates the Bearer token against Better Auth (the
 * MCP authorization server) and derives these from the token.
 */
function tenantContext(c: { req: { header: (k: string) => string | undefined } }) {
  return {
    organizationId: c.req.header("x-org-id"),
    profileId: c.req.header("x-graduate-profile-id"),
    actor: (c.req.header("x-actor") as "human" | "agent") ?? "human",
  };
}

// ── Agent + machine affordances ───────────────────────────────────────────────
app.get("/openapi.json", (c) => c.json(openApiDocument(`${originOf(c)}/api`)));
app.get("/.well-known/ai-directory.json", (c) =>
  c.json(wellKnownAffordance(`${originOf(c)}/api`, `${originOf(c)}/mcp`)),
);
app.get("/docs", (c) =>
  c.html(`<!doctype html><html><head><meta charset="utf-8"/>
    <title>The Directory API</title></head>
    <body><script id="api-reference" data-url="${originOf(c)}/api/openapi.json"></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
    </body></html>`),
);
app.get("/health", (c) => c.json({ ok: true }));

// ── Public directory ──────────────────────────────────────────────────────────
app.get("/v1/schools/:slug", async (c) => {
  const school = await getSchoolBySlug(c.req.param("slug"));
  if (!school) return c.json({ error: "school not found" }, 404);
  const { id: _id, ...pub } = school;
  return c.json(pub);
});

app.get("/v1/schools/:slug/search", async (c) => {
  const school = await getSchoolBySlug(c.req.param("slug"));
  if (!school) return c.json({ error: "school not found" }, 404);

  const parsed = SearchQuery.safeParse(c.req.query());
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const { actor } = tenantContext(c);
  const result = await searchDirectory(school.id, parsed.data);

  void capture({
    organizationId: school.id,
    eventType: "search",
    actor,
    props: { q: parsed.data.q, modality: parsed.data.modality },
  }).catch(() => {});
  if (actor === "agent") {
    void capture({ organizationId: school.id, eventType: "agent_query", actor }).catch(() => {});
  }

  return c.json(result);
});

app.get("/v1/schools/:slug/profiles/:profileSlug", async (c) => {
  const school = await getSchoolBySlug(c.req.param("slug"));
  if (!school) return c.json({ error: "school not found" }, 404);
  const detail = await getProfileDetail(school.id, c.req.param("profileSlug"));
  if (!detail) return c.json({ error: "profile not found" }, 404);

  const { actor } = tenantContext(c);
  void capture({
    organizationId: school.id,
    eventType: "profile_view",
    profileId: detail.id,
    actor,
  }).catch(() => {});

  if (c.req.query("format") === "jsonld") {
    return c.json(
      profileToJsonLd(
        detail,
        {
          slug: school.slug,
          name: school.name,
          logo: school.logo,
          themeColor: school.themeColor,
          heroCopy: school.heroCopy,
        },
        env.API_BASE_URL,
      ),
    );
  }
  return c.json(detail);
});

app.post("/v1/schools/:slug/profiles/:profileSlug/contact", async (c) => {
  const school = await getSchoolBySlug(c.req.param("slug"));
  if (!school) return c.json({ error: "school not found" }, 404);
  const detail = await getProfileDetail(school.id, c.req.param("profileSlug"));
  if (!detail) return c.json({ error: "profile not found" }, 404);
  await capture({
    organizationId: school.id,
    eventType: "contact_click",
    profileId: detail.id,
  });
  return c.json({ ok: true });
});

// ── AI insights & coaching ────────────────────────────────────────────────────
app.get("/v1/me/insights", async (c) => {
  const { organizationId, profileId } = tenantContext(c);
  if (!organizationId || !profileId)
    return c.json({ error: "missing tenant/profile context" }, 401);
  const insight = await latestInsightDTO(organizationId, "graduate", profileId);
  if (!insight) return c.json({ error: "no insight yet — run the nightly loop" }, 404);
  return c.json(insight);
});

app.get("/v1/admin/insights", async (c) => {
  const { organizationId } = tenantContext(c);
  if (!organizationId) return c.json({ error: "missing tenant context" }, 401);
  const insight = await latestInsightDTO(organizationId, "school", null);
  if (!insight) return c.json({ error: "no insight yet — run the nightly loop" }, 404);
  return c.json(insight);
});

// ── Billing webhook (Stripe) ──────────────────────────────────────────────────
app.post("/webhooks/stripe", async (c) => {
  const raw = await c.req.text();
  try {
    const result = await handleWebhook(raw, c.req.header("stripe-signature"));
    return c.json(result);
  } catch (err) {
    return c.json({ error: (err as Error).message }, 400);
  }
});

// ── Scheduled nightly LEARN loop (Vercel Cron) ────────────────────────────────
// vercel.json schedules a hit here; when CRON_SECRET is set in the project,
// Vercel includes `Authorization: Bearer <CRON_SECRET>`. Fail CLOSED — the loop
// never runs until that secret is configured. NOTE: this runs the loop inside a
// serverless invocation, which suits demo/small-tenant scale; for large
// Claude-backed runs use the always-on worker (apps/worker / render.yaml), which
// has no function-duration limit.
app.get("/intelligence/nightly", async (c) => {
  const secret = env.CRON_SECRET;
  if (!secret || c.req.header("authorization") !== `Bearer ${secret}`) {
    return c.json({ error: "unauthorized" }, 401);
  }
  await runNightly();
  return c.json({ ok: true });
});
