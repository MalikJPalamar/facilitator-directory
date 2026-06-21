import { capture } from "@directory/analytics";
import { auth } from "@directory/auth";
import { getSubscription, handleWebhook } from "@directory/billing";
import { env } from "@directory/config";
import {
  ApiKeyCreate,
  BrandingUpdate,
  ClaimTokenIssue,
  LeadCreate,
  ProfileUpdate,
  ReviewDecision,
  RosterImport,
  SCOPES,
  WebhookEndpointInput,
  WebhookToggle,
  profileToJsonLd,
  SearchQuery,
  wellKnownAffordance,
} from "@directory/contracts";
import {
  BlockedUrlError,
  ClaimError,
  createApiKey,
  createLead,
  createWebhookEndpoint,
  decideReview,
  deleteWebhookEndpoint,
  deltaOf,
  emit,
  enqueueReview,
  getOrganizationBranding,
  getOwnProfileDetail,
  getProfileDetail,
  getProfileForWrite,
  getProfileMetrics,
  getSchoolBySlug,
  getSchoolMetrics,
  importRoster,
  issueClaimToken,
  latestInsightDTO,
  LeadError,
  listApiKeys,
  listLeads,
  listPendingReviews,
  listRecentEvalRuns,
  listSchoolGraduates,
  listWebhookEndpoints,
  previewClaim,
  revokeApiKey,
  rotateWebhookSecret,
  runNightly,
  searchDirectory,
  setWebhookEndpointEnabled,
  updateOrganizationBranding,
  updateProfile,
} from "@directory/core";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { fail } from "./errors.ts";
import { withIdempotency } from "./idempotency.ts";
import { requestId, requestLogger } from "./middleware/observability.ts";
import { rateLimit } from "./middleware/rate-limit.ts";
import { requireScope, tenant } from "./middleware/tenant.ts";
import { openApiDocument } from "./openapi.ts";

/**
 * The REST API as a framework-agnostic Hono app, based at `/api` so it can be
 * mounted either as a standalone Node server (apps/api/src/index.ts, for
 * Render/local) OR inside the Next.js app as a catch-all route handler
 * (apps/web app/api/[[...route]]/route.ts, for the single-Vercel deploy).
 * The integration contract base URL is therefore `<origin>/api`.
 */
export const app = new Hono().basePath("/api");
// Request-id + structured timing wrap EVERYTHING (incl. auth + webhooks), and
// must run first. requestId honors/emits X-Request-Id; requestLogger emits one
// secret-free JSON line per request.
app.use("*", requestId());
app.use("*", requestLogger());
app.use("*", cors());

/**
 * Better Auth — identity + the organization (tenant) plugin. Mounted here so the
 * single Vercel deploy serves auth at `<origin>/api/auth/*` (Better Auth's
 * default basePath). The handler gets the raw Web Request; cookies + sessions
 * flow through the same origin as the app, so no cross-site config is needed.
 */
app.on(["GET", "POST"], "/auth/*", (c) => auth.handler(c.req.raw));

/**
 * Resolve the caller to {organizationId, scopes, actor} for every /v1 route —
 * from a validated Bearer API key (prod) or, in dev only, legacy x-org-id
 * headers. Public read routes ignore the result; protected routes gate on it.
 */
app.use("/v1/*", tenant());
// MUST be after tenant() so c.var.tenant.keyId is set (per-key vs per-IP).
app.use("/v1/*", rateLimit());

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

// ── Agent + machine affordances ───────────────────────────────────────────────
app.get("/openapi.json", (c) => c.json(openApiDocument(`${originOf(c)}/api`)));
app.get("/.well-known/ai-directory.json", (c) =>
  c.json(wellKnownAffordance(`${originOf(c)}/api`, `${originOf(c)}/mcp`)),
);
/**
 * OAuth 2.0 Protected Resource Metadata (RFC 9728) — lets an agent auto-discover
 * how to authenticate. We issue first-party Bearer API keys (minted at
 * `/admin/keys`), advertised here alongside the supported scopes.
 */
app.get("/.well-known/oauth-protected-resource", (c) =>
  c.json({
    resource: `${originOf(c)}/api`,
    bearer_methods_supported: ["header"],
    scopes_supported: Object.values(SCOPES),
    token_issuance: `${originOf(c)}/admin/keys`,
    token_type: "first-party-api-key",
  }),
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

  const { actor } = c.var.tenant;
  const result = await searchDirectory(school.id, parsed.data);

  void capture({
    organizationId: school.id,
    eventType: "search",
    actor,
    props: { q: parsed.data.q, modality: parsed.data.modality },
  }).catch(() => {});
  if (actor === "agent") {
    void capture({ organizationId: school.id, eventType: "agent_query", actor }).catch(() => {});
    // Push agent demand to the school's CRM (human searches are NOT emitted).
    void emit({
      organizationId: school.id,
      type: "search.performed",
      data: { q: parsed.data.q, modality: parsed.data.modality, resultCount: result.total },
    });
  }

  return c.json(result);
});

app.get("/v1/schools/:slug/profiles/:profileSlug", async (c) => {
  const school = await getSchoolBySlug(c.req.param("slug"));
  if (!school) return c.json({ error: "school not found" }, 404);
  const detail = await getProfileDetail(school.id, c.req.param("profileSlug"));
  if (!detail) return c.json({ error: "profile not found" }, 404);

  const { actor } = c.var.tenant;
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
        // Use the real request origin so @id/url point at the live deployment
        // (was env.API_BASE_URL, which is http://localhost:8787 in prod).
        originOf(c),
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
  // The raw interaction (contact.requested) and its CRM-facing alias
  // (lead.created) — a CRM can subscribe to whichever it maps onto.
  void emit({
    organizationId: school.id,
    type: "contact.requested",
    data: { profileId: detail.id, profileSlug: detail.slug },
  });
  void emit({
    organizationId: school.id,
    type: "lead.created",
    data: { profileId: detail.id, profileSlug: detail.slug },
  });
  return c.json({ ok: true });
});

// ── Write / ingest API (agents & CRMs — Bearer key + scopes) ───────────────────

/**
 * Submit an inbound lead. Targets a graduate (profileSlug) or the school as a
 * whole. Idempotent via the Idempotency-Key header. Requires leads:write.
 */
app.post("/v1/schools/:slug/leads", requireScope(SCOPES.leadsWrite), async (c) => {
  const ctx = c.var.tenant;
  const school = await getSchoolBySlug(c.req.param("slug"));
  if (!school) return fail(c, 404, "not_found", "school not found");
  // IDOR guard: the token's org must own the school in the path.
  if (school.id !== ctx.organizationId)
    return fail(c, 403, "insufficient_scope", "token not authorized for this school");

  const parsed = LeadCreate.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success)
    return fail(c, 400, "validation_error", "invalid lead", parsed.error.flatten());

  let profileId: string | undefined;
  if (parsed.data.profileSlug) {
    const p = await getProfileForWrite(school.id, parsed.data.profileSlug);
    if (!p) return fail(c, 404, "not_found", "profile not found");
    profileId = p.id;
  }

  try {
    return await withIdempotency(c, ctx, async () => {
      const lead = await createLead({
        organizationId: school.id,
        profileId,
        contactName: parsed.data.contactName,
        contactEmail: parsed.data.contactEmail,
        contactPhone: parsed.data.contactPhone,
        message: parsed.data.message,
        kind: parsed.data.kind,
        source: parsed.data.source,
        props: parsed.data.props,
        submittedBy: ctx.keyId,
      });
      void capture({
        organizationId: school.id,
        eventType: "lead_created",
        profileId,
        actor: "agent",
        props: { source: parsed.data.source, kind: parsed.data.kind },
      }).catch(() => {});
      void emit({
        organizationId: school.id,
        type: "lead.created",
        data: { leadId: lead.id, profileId, kind: parsed.data.kind, source: parsed.data.source },
      });
      return {
        status: 201,
        body: { id: lead.id, kind: parsed.data.kind, status: "new", createdAt: lead.createdAt },
      };
    });
  } catch (err) {
    if (err instanceof LeadError) return fail(c, 404, "not_found", err.message);
    throw err;
  }
});

/**
 * Agent-assisted profile edit. Requires profiles:write. Edits to a PUBLISHED
 * profile are routed to the human review queue (humans stay above the loop)
 * rather than applied directly; draft/hidden profiles are updated in place.
 */
app.patch(
  "/v1/schools/:slug/profiles/:profileSlug",
  requireScope(SCOPES.profilesWrite),
  async (c) => {
    const ctx = c.var.tenant;
    const school = await getSchoolBySlug(c.req.param("slug"));
    if (!school) return fail(c, 404, "not_found", "school not found");
    if (school.id !== ctx.organizationId)
      return fail(c, 403, "insufficient_scope", "token not authorized for this school");

    const parsed = ProfileUpdate.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success)
      return fail(c, 400, "validation_error", "invalid patch", parsed.error.flatten());

    const target = await getProfileForWrite(school.id, c.req.param("profileSlug"));
    if (!target) return fail(c, 404, "not_found", "profile not found");

    if (target.status === "published") {
      const reviewId = await enqueueReview({
        organizationId: school.id,
        profileId: target.id,
        kind: "profile_change_suggestion",
        proposedBy: "agent",
        payload: parsed.data,
      });
      return c.json({ queued: true, reviewId }, 202);
    }

    await updateProfile(school.id, target.id, parsed.data);
    return c.json({ ok: true }, 200);
  },
);

/**
 * Bulk roster upsert over HTTP — the provision-school CLI made callable.
 * Idempotent via Idempotency-Key. Requires roster:admin.
 */
app.post("/v1/schools/:slug/roster", requireScope(SCOPES.rosterAdmin), async (c) => {
  const ctx = c.var.tenant;
  const school = await getSchoolBySlug(c.req.param("slug"));
  if (!school) return fail(c, 404, "not_found", "school not found");
  if (school.id !== ctx.organizationId)
    return fail(c, 403, "insufficient_scope", "token not authorized for this school");

  const parsed = RosterImport.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success)
    return fail(c, 400, "validation_error", "invalid roster", parsed.error.flatten());

  return withIdempotency(c, ctx, async () => {
    const r = await importRoster(school.id, parsed.data, { baseUrl: originOf(c) });
    return { status: 200, body: r };
  });
});

// ── AI insights & coaching ────────────────────────────────────────────────────
app.get("/v1/me/insights", requireScope(SCOPES.insightsRead), async (c) => {
  const { organizationId, profileId } = c.var.tenant;
  if (!organizationId || !profileId)
    return fail(c, 401, "unauthorized", "missing tenant/profile context");
  const insight = await latestInsightDTO(organizationId, "graduate", profileId);
  if (!insight) return fail(c, 404, "not_found", "no insight yet — run the nightly loop");
  return c.json(insight);
});

app.get("/v1/admin/insights", requireScope(SCOPES.insightsRead), async (c) => {
  const { organizationId } = c.var.tenant;
  if (!organizationId) return fail(c, 401, "unauthorized", "missing tenant context");
  const insight = await latestInsightDTO(organizationId, "school", null);
  if (!insight) return fail(c, 404, "not_found", "no insight yet — run the nightly loop");
  return c.json(insight);
});

// ── Metrics (admin + me) ──────────────────────────────────────────────────────
const WINDOW_DAYS: Record<string, number> = { "7d": 7, "28d": 28, "90d": 90 };
function windowRange(q: string | undefined): { days: number; curFrom: Date; prevFrom: Date; now: Date } {
  const days = WINDOW_DAYS[q ?? "28d"] ?? 28;
  const now = new Date();
  return {
    days,
    now,
    curFrom: new Date(now.getTime() - days * 864e5),
    prevFrom: new Date(now.getTime() - 2 * days * 864e5),
  };
}

app.get("/v1/admin/metrics", requireScope(SCOPES.schoolAdmin), async (c) => {
  const org = c.var.tenant.organizationId!;
  const { days, curFrom, prevFrom, now } = windowRange(c.req.query("window"));
  const current = await getSchoolMetrics(org, curFrom, now);
  const previous = await getSchoolMetrics(org, prevFrom, curFrom);
  return c.json({ window: `${days}d`, current, previous, delta: deltaOf(current, previous) });
});

app.get("/v1/me/metrics", requireScope(SCOPES.insightsRead), async (c) => {
  const { organizationId, profileId } = c.var.tenant;
  if (!organizationId || !profileId)
    return fail(c, 401, "unauthorized", "missing tenant/profile context");
  const { days, curFrom, prevFrom, now } = windowRange(c.req.query("window"));
  const current = await getProfileMetrics(profileId, curFrom, now);
  const previous = await getProfileMetrics(profileId, prevFrom, curFrom);
  return c.json({ window: `${days}d`, current, previous, delta: deltaOf(current, previous) });
});

// ── Graduates + own profile ───────────────────────────────────────────────────
app.get("/v1/admin/graduates", requireScope(SCOPES.schoolAdmin), async (c) => {
  const graduates = await listSchoolGraduates(c.var.tenant.organizationId!);
  return c.json({ graduates });
});

app.get("/v1/me/profile", requireScope(SCOPES.profilesWrite), async (c) => {
  const { organizationId, profileId } = c.var.tenant;
  if (!organizationId || !profileId)
    return fail(c, 401, "unauthorized", "missing tenant/profile context");
  const profile = await getOwnProfileDetail({ organizationId, profileId });
  if (!profile) return fail(c, 404, "not_found", "profile not found");
  return c.json(profile);
});

// ── Claim (public preview + admin issue) ──────────────────────────────────────
app.get("/v1/schools/:slug/claims/:token/preview", async (c) => {
  const preview = await previewClaim(c.req.param("token"));
  if (!preview) return c.json({ error: "claim not found or expired" }, 404);
  return c.json(preview);
});

app.post("/v1/admin/claims", requireScope(SCOPES.schoolAdmin), async (c) => {
  const ctx = c.var.tenant;
  const parsed = ClaimTokenIssue.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success)
    return fail(c, 400, "validation_error", "invalid request", parsed.error.flatten());
  // Tenant guard: the profile must belong to the caller's org (issueClaimToken
  // itself is not org-scoped, so verify ownership by id here).
  const owned = await listSchoolGraduates(ctx.organizationId!);
  if (!owned.some((g) => g.id === parsed.data.profileId))
    return fail(c, 404, "not_found", "profile not found");
  return withIdempotency(c, ctx, async () => {
    try {
      const token = await issueClaimToken(parsed.data.profileId);
      return { status: 201, body: { token, claimUrl: `${originOf(c)}/claim/${token}` } };
    } catch (err) {
      if (err instanceof ClaimError)
        return { status: 409, body: { error: { code: "conflict", message: err.message } } };
      throw err;
    }
  });
});

// ── Review queue (list + decide) ──────────────────────────────────────────────
app.get("/v1/admin/reviews", requireScope(SCOPES.reviewsWrite), async (c) => {
  const reviews = await listPendingReviews(c.var.tenant.organizationId!);
  return c.json({ reviews });
});

app.post("/v1/admin/reviews/:id/decision", requireScope(SCOPES.reviewsWrite), async (c) => {
  const parsed = ReviewDecision.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success)
    return fail(c, 400, "validation_error", "invalid decision", parsed.error.flatten());
  const ok = await decideReview(
    c.var.tenant.organizationId!,
    c.req.param("id"),
    parsed.data.decision,
    c.var.tenant.keyId ?? "agent",
  );
  if (!ok) return fail(c, 404, "not_found", "review item not found");
  return c.json({ ok: true });
});

// ── Eval runs (insight quality) ───────────────────────────────────────────────
app.get("/v1/admin/eval-runs", requireScope(SCOPES.schoolAdmin), async (c) => {
  const limit = Math.min(50, Math.max(1, Number(c.req.query("limit")) || 10));
  const runs = await listRecentEvalRuns(limit);
  return c.json({ runs });
});

// ── Branding (get + update) ───────────────────────────────────────────────────
app.get("/v1/admin/branding", requireScope(SCOPES.schoolAdmin), async (c) => {
  const branding = await getOrganizationBranding(c.var.tenant.organizationId!);
  if (!branding) return fail(c, 404, "not_found", "organization not found");
  return c.json(branding);
});

app.patch("/v1/admin/branding", requireScope(SCOPES.schoolAdmin), async (c) => {
  const parsed = BrandingUpdate.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success)
    return fail(c, 400, "validation_error", "invalid branding", parsed.error.flatten());
  await updateOrganizationBranding(c.var.tenant.organizationId!, {
    name: parsed.data.name ?? "",
    logo: parsed.data.logo ?? "",
    themeColor: parsed.data.themeColor ?? "",
    heroCopy: parsed.data.heroCopy ?? "",
  });
  return c.json({ ok: true });
});

// ── API keys (list / create / revoke) — subset-mint rule on create ────────────
app.get("/v1/admin/keys", requireScope(SCOPES.keysAdmin), async (c) => {
  const keys = await listApiKeys(c.var.tenant.organizationId!);
  return c.json({ keys });
});

app.post("/v1/admin/keys", requireScope(SCOPES.keysAdmin), async (c) => {
  const ctx = c.var.tenant;
  const parsed = ApiKeyCreate.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success)
    return fail(c, 400, "validation_error", "invalid key request", parsed.error.flatten());
  // SUBSET-MINT RULE: a key may only grant scopes it itself holds.
  const ungrantable = parsed.data.scopes.filter((s) => !ctx.scopes.includes(s));
  if (ungrantable.length)
    return fail(c, 403, "insufficient_scope", `cannot grant scopes beyond the minting key: ${ungrantable.join(", ")}`);
  return withIdempotency(c, ctx, async () => {
    const { id, plaintext, prefix } = await createApiKey({
      organizationId: ctx.organizationId!,
      name: parsed.data.name,
      scopes: parsed.data.scopes,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    });
    return { status: 201, body: { id, prefix, plaintext } };
  });
});

app.delete("/v1/admin/keys/:id", requireScope(SCOPES.keysAdmin), async (c) => {
  await revokeApiKey(c.var.tenant.organizationId!, c.req.param("id"));
  return c.json({ ok: true });
});

// ── Webhooks (list / create / toggle / rotate / delete) ───────────────────────
app.get("/v1/admin/webhooks", requireScope(SCOPES.webhooksAdmin), async (c) => {
  const endpoints = await listWebhookEndpoints(c.var.tenant.organizationId!);
  return c.json({ endpoints });
});

app.post("/v1/admin/webhooks", requireScope(SCOPES.webhooksAdmin), async (c) => {
  const parsed = WebhookEndpointInput.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success)
    return fail(c, 400, "validation_error", "invalid endpoint", parsed.error.flatten());
  try {
    const { id, secret } = await createWebhookEndpoint({
      organizationId: c.var.tenant.organizationId!,
      url: parsed.data.url,
      events: parsed.data.events,
      description: parsed.data.description,
    });
    return c.json({ id, secret }, 201); // secret returned ONCE
  } catch (err) {
    if (err instanceof BlockedUrlError) return fail(c, 422, "validation_error", err.message);
    throw err;
  }
});

app.patch("/v1/admin/webhooks/:id", requireScope(SCOPES.webhooksAdmin), async (c) => {
  const parsed = WebhookToggle.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success)
    return fail(c, 400, "validation_error", "invalid toggle", parsed.error.flatten());
  await setWebhookEndpointEnabled(c.var.tenant.organizationId!, c.req.param("id"), parsed.data.enabled);
  return c.json({ ok: true });
});

app.post("/v1/admin/webhooks/:id/rotate", requireScope(SCOPES.webhooksAdmin), async (c) => {
  const secret = await rotateWebhookSecret(c.var.tenant.organizationId!, c.req.param("id"));
  if (!secret) return fail(c, 404, "not_found", "endpoint not found");
  return c.json({ secret });
});

app.delete("/v1/admin/webhooks/:id", requireScope(SCOPES.webhooksAdmin), async (c) => {
  await deleteWebhookEndpoint(c.var.tenant.organizationId!, c.req.param("id"));
  return c.json({ ok: true });
});

// ── Leads list (admin) ────────────────────────────────────────────────────────
app.get("/v1/admin/leads", requireScope(SCOPES.leadsRead), async (c) => {
  const limit = Math.min(500, Math.max(1, Number(c.req.query("limit")) || 100));
  const leads = await listLeads(c.var.tenant.organizationId!, limit);
  return c.json({ leads });
});

// ── Subscription status (admin read-only) ─────────────────────────────────────
app.get("/v1/admin/subscription", requireScope(SCOPES.schoolAdmin), async (c) => {
  const sub = await getSubscription(c.var.tenant.organizationId!);
  return c.json(
    sub ?? { status: "none", plan: "school_membership", seats: 0, currentPeriodEnd: null, stripeCustomerId: null },
  );
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
