# The Directory — machine API

A universal, agent- and CRM-connectable API. Everything the web app does is
available over HTTP so external agents and third-party systems can discover,
read, and write.

Base URL: `https://<your-domain>/api`
Interactive reference: `https://<your-domain>/api/docs` (OpenAPI at `/api/openapi.json`)

## Discovery

Agents can bootstrap with no prior knowledge:

- `GET /api/.well-known/ai-directory.json` — capabilities, MCP endpoint, auth scheme, webhook events
- `GET /api/.well-known/oauth-protected-resource` — RFC 9728 metadata (scopes, how to get a token)
- `GET /api/openapi.json` — full OpenAPI 3.1 document
- MCP server at `/mcp` (streamable HTTP) — `search_directory`, `get_profile`

## Authentication

Reads of public directory data need **no** auth. Everything else uses an
org-scoped API key. Mint one at **Admin → API keys** (shown once):

```
Authorization: Bearer dk_live_…
```

### Scopes

| Scope             | Grants                                              |
| ----------------- | --------------------------------------------------- |
| `directory:read`  | Read schools & profiles                             |
| `insights:read`   | Read AI insights + metrics                          |
| `leads:write`     | Submit inbound leads                                |
| `leads:read`      | List inbound leads                                  |
| `profiles:write`  | Edit graduate profiles                              |
| `roster:admin`    | Bulk-import the facilitator roster                  |
| `reviews:write`   | List + decide queued profile-change reviews         |
| `webhooks:admin`  | Manage outbound webhook endpoints                   |
| `keys:admin`      | Mint/revoke API keys (subset-mint rule)             |
| `school:admin`    | Org config: branding, subscription, graduates, eval-runs, claim-issue, metrics |

A key is scoped to exactly one school (organization). Calls whose `:slug` path
doesn't belong to the key's org are rejected `403`. A key may only mint keys
whose scopes are a **subset** of its own.

## Endpoints

### Read (public)

```
GET  /api/v1/schools/:slug
GET  /api/v1/schools/:slug/search?q=…&modality=…&lat=…&lng=…&online=true&page=1
GET  /api/v1/schools/:slug/profiles/:profileSlug          # ?format=jsonld for schema.org
POST /api/v1/schools/:slug/profiles/:profileSlug/contact  # register a contact-click
```

### Write (Bearer key)

```
POST  /api/v1/schools/:slug/leads                 # scope: leads:write
PATCH /api/v1/schools/:slug/profiles/:profileSlug # scope: profiles:write
POST  /api/v1/schools/:slug/roster                # scope: roster:admin
GET   /api/v1/schools/:slug/claims/:token/preview # public — claim-flow read side
```

`PATCH` to a **published** profile is queued for human review (`202 { queued, reviewId }`);
draft/hidden profiles are updated in place (`200`).

### Admin / org management (Bearer key)

Every directory feature is reachable over the API — these power the MCP server,
the CLI, and any third-party integration:

```
GET    /api/v1/admin/metrics?window=28d        # school:admin — engagement + delta
GET    /api/v1/me/metrics?window=28d           # insights:read — own metrics
GET    /api/v1/admin/graduates                 # school:admin
GET    /api/v1/me/profile                       # profiles:write
POST   /api/v1/admin/claims                     # school:admin — issue a claim token
GET    /api/v1/admin/reviews                    # reviews:write — pending changes
POST   /api/v1/admin/reviews/:id/decision       # reviews:write — approve|reject
GET    /api/v1/admin/eval-runs                  # school:admin — insight quality
GET    /api/v1/admin/branding                   # school:admin
PATCH  /api/v1/admin/branding                   # school:admin
GET    /api/v1/admin/keys                       # keys:admin
POST   /api/v1/admin/keys                       # keys:admin — mint (subset rule)
DELETE /api/v1/admin/keys/:id                   # keys:admin — revoke
GET    /api/v1/admin/webhooks                   # webhooks:admin
POST   /api/v1/admin/webhooks                   # webhooks:admin — returns secret once
PATCH  /api/v1/admin/webhooks/:id               # webhooks:admin — enable/disable
POST   /api/v1/admin/webhooks/:id/rotate        # webhooks:admin — new secret once
DELETE /api/v1/admin/webhooks/:id               # webhooks:admin
GET    /api/v1/admin/leads                      # leads:read
GET    /api/v1/admin/subscription               # school:admin
```

### Rate limits

Every `/v1` request returns `RateLimit-Limit`, `RateLimit-Remaining`,
`RateLimit-Reset`. Over the limit → `429` with `Retry-After`. Limits are
per-key (or per-IP when anonymous) and per route-class (read/search/write).

Submit a lead from a CRM:

```bash
curl -X POST https://<domain>/api/v1/schools/acme/leads \
  -H "authorization: Bearer dk_live_…" \
  -H "content-type: application/json" \
  -H "idempotency-key: $(uuidgen)" \
  -d '{"profileSlug":"jane-doe","contactEmail":"buyer@x.com","message":"Booking?","source":"crm:hubspot"}'
```

### Idempotency

`POST /leads` and `POST /roster` honour an `Idempotency-Key` header: a retry with
the same key replays the original response instead of writing again.

### Errors

Every machine route returns a single envelope:

```json
{ "error": { "code": "insufficient_scope", "message": "requires scope: leads:write" } }
```

Codes: `unauthorized` (401), `insufficient_scope` (403), `not_found` (404),
`validation_error` (400), `conflict` (409), `rate_limited` (429), `internal` (500).

## Webhooks (push to your CRM)

Register signed outbound endpoints — see [webhooks.md](./webhooks.md).

## MCP (agent tools)

The same capabilities are exposed as MCP tools over streamable HTTP at `/mcp`.
Public: `search_directory`, `get_profile`, `get_school`. Authed (pass the API key
as the `Authorization: Bearer` header on the MCP transport, or the `apiKey` tool
arg as a fallback): `create_lead` (leads:write), `suggest_profile_edit`
(profiles:write — published edits go to review), `get_insights` (insights:read).

## CLI

`@directory/cli` ships a `directory` binary — a thin HTTP client over this API.
Set `DIRECTORY_BASE_URL` and `DIRECTORY_API_KEY`, then e.g.
`directory search --school acme --q reiki`,
`directory leads list`, `directory keys create --name "CRM" --scope leads:write`.
See `apps/cli/README.md`.
