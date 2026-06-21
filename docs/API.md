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
| `insights:read`   | Read AI insights for the school                     |
| `leads:write`     | Submit inbound leads                                |
| `profiles:write`  | Edit graduate profiles                              |
| `roster:admin`    | Bulk-import the facilitator roster                  |

A key is scoped to exactly one school (organization). Calls whose `:slug` path
doesn't belong to the key's org are rejected `403`.

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
```

`PATCH` to a **published** profile is queued for human review (`202 { queued, reviewId }`);
draft/hidden profiles are updated in place (`200`).

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
