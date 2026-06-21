/** Minimal OpenAPI document for the public surface (served at /openapi.json). */
export function openApiDocument(baseUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "The Directory API",
      version: "0.1.0",
      description:
        "Headless, AI-native marketplace API. The single source of truth consumed by the web app, MCP server, and distribution adapters (WordPress, Web Component, …). Designed for agents as first-class consumers.",
    },
    servers: [{ url: baseUrl }],
    components: {
      securitySchemes: {
        // First-party org-scoped API key minted at /admin/keys.
        apiKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "dk_live_…",
          description:
            "Org-scoped API key. Mint at /admin/keys. Send as `Authorization: Bearer dk_live_…`. Scopes: directory:read, insights:read, leads:write, profiles:write, roster:admin.",
        },
      },
    },
    paths: {
      "/v1/schools/{slug}": {
        get: {
          summary: "School (tenant) public profile + branding",
          parameters: [pathParam("slug")],
          responses: ok("School"),
        },
      },
      "/v1/schools/{slug}/search": {
        get: {
          summary: "Faceted + geo + semantic directory search",
          parameters: [
            pathParam("slug"),
            q("q", "Natural-language / keyword query (semantic)"),
            q("modality", "Modality slug filter"),
            q("lat", "Latitude for geo search"),
            q("lng", "Longitude for geo search"),
            q("radiusKm", "Geo radius in km"),
            q("online", "Only online-capable practitioners"),
            q("page", "Page (1-based)"),
            q("pageSize", "Page size (max 50)"),
          ],
          responses: ok("SearchResult"),
        },
      },
      "/v1/schools/{slug}/profiles/{profileSlug}/contact": {
        post: {
          summary: "Register a contact-click for a profile (public)",
          parameters: [pathParam("slug"), pathParam("profileSlug")],
          responses: ok("Ack"),
        },
      },
      "/v1/schools/{slug}/leads": {
        post: {
          summary: "Submit an inbound lead (CRM/agent). Scope: leads:write",
          description:
            "Idempotent when an `Idempotency-Key` header is supplied. Targets a graduate via `profileSlug`, or the school as a whole when omitted.",
          security: [{ apiKey: [] }],
          parameters: [pathParam("slug"), idempotencyHeader()],
          requestBody: jsonBody("LeadCreate"),
          responses: { ...created("Lead"), ...errs() },
        },
      },
      "/v1/schools/{slug}/profiles/{profileSlug}": {
        get: {
          summary: "Graduate profile detail (add ?format=jsonld for schema.org)",
          parameters: [pathParam("slug"), pathParam("profileSlug")],
          responses: ok("ProfileDetail"),
        },
        patch: {
          summary: "Agent-assisted profile edit. Scope: profiles:write",
          description:
            "Edits to a PUBLISHED profile are queued for human review (202); draft/hidden profiles are updated in place (200).",
          security: [{ apiKey: [] }],
          parameters: [pathParam("slug"), pathParam("profileSlug")],
          requestBody: jsonBody("ProfileUpdate"),
          responses: { ...ok("Profile updated or queued"), ...errs() },
        },
      },
      "/v1/schools/{slug}/roster": {
        post: {
          summary: "Bulk roster upsert (CRM/agent). Scope: roster:admin",
          description:
            "Idempotent when an `Idempotency-Key` header is supplied. Mirrors the provision-school CLI over HTTP.",
          security: [{ apiKey: [] }],
          parameters: [pathParam("slug"), idempotencyHeader()],
          requestBody: jsonBody("RosterImport"),
          responses: { ...ok("RosterImportResult"), ...errs() },
        },
      },
      "/v1/me/insights": {
        get: {
          summary: "AI insights & coaching for the authenticated graduate",
          security: [{ apiKey: [] }],
          responses: { ...ok("Insight"), ...errs() },
        },
      },
      "/v1/admin/insights": {
        get: {
          summary: "AI insights for the school (admin). Scope: insights:read",
          security: [{ apiKey: [] }],
          responses: { ...ok("Insight"), ...errs() },
        },
      },
      "/v1/schools/{slug}/claims/{token}/preview": {
        get: {
          summary: "Preview a claim token (public — the human-claim flow's read side)",
          parameters: [pathParam("slug"), pathParam("token")],
          responses: { ...ok("ClaimPreview"), "404": { description: "not found / expired" } },
        },
      },
      "/v1/admin/metrics": adminGet("School engagement metrics + delta. Scope: school:admin", [q("window", "7d | 28d | 90d")]),
      "/v1/me/metrics": adminGet("The graduate's own metrics + delta. Scope: insights:read", [q("window", "7d | 28d | 90d")]),
      "/v1/admin/graduates": adminGet("List the school's graduate profiles. Scope: school:admin"),
      "/v1/me/profile": adminGet("The graduate's own editable profile. Scope: profiles:write"),
      "/v1/admin/eval-runs": adminGet("Recent eval runs (insight quality). Scope: school:admin", [q("limit", "max 50")]),
      "/v1/admin/leads": adminGet("List inbound leads. Scope: leads:read", [q("limit", "max 500")]),
      "/v1/admin/subscription": adminGet("Subscription status (read-only). Scope: school:admin"),
      "/v1/admin/branding": {
        get: { summary: "Get school branding. Scope: school:admin", security: [{ apiKey: [] }], responses: { ...ok("Branding"), ...errs() } },
        patch: { summary: "Update school branding. Scope: school:admin", security: [{ apiKey: [] }], requestBody: jsonBody("BrandingUpdate"), responses: { ...ok("Ack"), ...errs() } },
      },
      "/v1/admin/claims": {
        post: { summary: "Issue a single-use claim token for a profile. Scope: school:admin", security: [{ apiKey: [] }], parameters: [idempotencyHeader()], requestBody: jsonBody("ClaimTokenIssue"), responses: { ...created("ClaimToken"), ...errs() } },
      },
      "/v1/admin/reviews": adminGet("List pending profile-change reviews. Scope: reviews:write"),
      "/v1/admin/reviews/{id}/decision": {
        post: { summary: "Approve/reject a queued change. Scope: reviews:write", security: [{ apiKey: [] }], parameters: [pathParam("id")], requestBody: jsonBody("ReviewDecision"), responses: { ...ok("Ack"), ...errs() } },
      },
      "/v1/admin/keys": {
        get: { summary: "List API keys. Scope: keys:admin", security: [{ apiKey: [] }], responses: { ...ok("ApiKeyList"), ...errs() } },
        post: { summary: "Mint an API key (scopes ⊆ minting key). Scope: keys:admin", security: [{ apiKey: [] }], parameters: [idempotencyHeader()], requestBody: jsonBody("ApiKeyCreate"), responses: { ...created("ApiKeyCreateResult"), ...errs() } },
      },
      "/v1/admin/keys/{id}": {
        delete: { summary: "Revoke an API key. Scope: keys:admin", security: [{ apiKey: [] }], parameters: [pathParam("id")], responses: { ...ok("Ack"), ...errs() } },
      },
      "/v1/admin/webhooks": {
        get: { summary: "List webhook endpoints. Scope: webhooks:admin", security: [{ apiKey: [] }], responses: { ...ok("WebhookList"), ...errs() } },
        post: { summary: "Register a webhook endpoint (returns secret once). Scope: webhooks:admin", security: [{ apiKey: [] }], requestBody: jsonBody("WebhookEndpointInput"), responses: { ...created("WebhookSecret"), ...errs() } },
      },
      "/v1/admin/webhooks/{id}": {
        patch: { summary: "Enable/disable an endpoint. Scope: webhooks:admin", security: [{ apiKey: [] }], parameters: [pathParam("id")], requestBody: jsonBody("WebhookToggle"), responses: { ...ok("Ack"), ...errs() } },
        delete: { summary: "Delete an endpoint. Scope: webhooks:admin", security: [{ apiKey: [] }], parameters: [pathParam("id")], responses: { ...ok("Ack"), ...errs() } },
      },
      "/v1/admin/webhooks/{id}/rotate": {
        post: { summary: "Rotate an endpoint's signing secret (returns secret once). Scope: webhooks:admin", security: [{ apiKey: [] }], parameters: [pathParam("id")], responses: { ...ok("WebhookSecret"), ...errs() } },
      },
    },
  };
}

/** A scope-gated admin GET path entry (bearer + standard error envelopes). */
const adminGet = (summary: string, parameters: unknown[] = []) => ({
  get: { summary, security: [{ apiKey: [] }], parameters, responses: { ...ok("OK"), ...errs() } },
});

const pathParam = (name: string) => ({
  name,
  in: "path",
  required: true,
  schema: { type: "string" },
});
const q = (name: string, description: string) => ({
  name,
  in: "query",
  required: false,
  description,
  schema: { type: "string" },
});
const ok = (label: string) => ({
  "200": { description: `${label} response` },
});
const created = (label: string) => ({
  "201": { description: `${label} created` },
});
const idempotencyHeader = () => ({
  name: "Idempotency-Key",
  in: "header",
  required: false,
  description: "Opaque key; a retry with the same key replays the first result.",
  schema: { type: "string" },
});
const jsonBody = (label: string) => ({
  required: true,
  content: { "application/json": { schema: { title: label, type: "object" } } },
});
const errs = () => ({
  "400": { description: "validation_error (ErrorEnvelope)" },
  "401": { description: "unauthorized (ErrorEnvelope)" },
  "403": { description: "insufficient_scope (ErrorEnvelope)" },
  "404": { description: "not_found (ErrorEnvelope)" },
  "429": { description: "rate_limited (ErrorEnvelope); see RateLimit-* + Retry-After headers" },
});
