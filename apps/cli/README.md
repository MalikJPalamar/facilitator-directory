# @directory/cli

`directory` — a zero-dependency, thin HTTP client over The Directory REST API.
It is a pure `fetch` client (Node 22 built-ins only) and never imports any
workspace package, so it works against **any** deployment of the API.

## Install / run

There is no build step; it runs straight from TypeScript via `tsx`.

```sh
# From the repo root, through pnpm (note the `--` before CLI args):
pnpm --filter @directory/cli dev -- search --school acme --q yoga

# Or directly with tsx inside apps/cli:
pnpm dlx tsx src/index.ts search --school acme --q yoga
```

## Configuration

Config precedence is **flags > environment**.

| Setting  | Flag             | Env var               | Notes                                   |
| -------- | ---------------- | --------------------- | --------------------------------------- |
| Base URL | `--base-url`     | `DIRECTORY_BASE_URL`  | API origin; `/api` is appended for you. |
| API key  | `--key`          | `DIRECTORY_API_KEY`   | Sent as `Authorization: Bearer <key>`.  |

Global flags: `--json` (raw JSON instead of tables), `-h` / `--help`.

Public commands work without a key. Authed commands fail fast with a friendly
"set DIRECTORY_API_KEY" message **before** any network call. Every `POST`/
`PATCH`/`DELETE` auto-sends an `Idempotency-Key` (overridable where exposed).

```sh
export DIRECTORY_BASE_URL=https://directory.example.com
export DIRECTORY_API_KEY=sk_live_...
```

## Commands

| Command                         | Method + endpoint                                  | Auth |
| ------------------------------- | -------------------------------------------------- | ---- |
| `search`                        | GET `/v1/schools/:slug/search`                     | no   |
| `school get`                    | GET `/v1/schools/:slug`                            | no   |
| `profile get`                   | GET `/v1/schools/:slug/profiles/:profileSlug`      | no   |
| `profile edit`                  | PATCH `/v1/schools/:slug/profiles/:profileSlug`    | yes  |
| `leads create`                  | POST `/v1/schools/:slug/leads`                     | yes  |
| `leads list`                    | GET `/v1/admin/leads`                              | yes  |
| `roster import <file.json>`     | POST `/v1/schools/:slug/roster`                    | yes  |
| `keys list`                     | GET `/v1/admin/keys`                               | yes  |
| `keys create`                   | POST `/v1/admin/keys`                              | yes  |
| `keys revoke`                   | DELETE `/v1/admin/keys/:id`                        | yes  |
| `webhooks list`                 | GET `/v1/admin/webhooks`                           | yes  |
| `webhooks add`                  | POST `/v1/admin/webhooks`                          | yes  |
| `webhooks toggle`               | PATCH `/v1/admin/webhooks/:id`                     | yes  |
| `webhooks rotate`               | POST `/v1/admin/webhooks/:id/rotate`               | yes  |
| `webhooks rm`                   | DELETE `/v1/admin/webhooks/:id`                    | yes  |
| `branding get`                  | GET `/v1/admin/branding`                           | yes  |
| `branding set`                  | PATCH `/v1/admin/branding`                         | yes  |
| `reviews list`                  | GET `/v1/admin/reviews`                            | yes  |
| `reviews decide`                | POST `/v1/admin/reviews/:id/decision`              | yes  |
| `insights me`                   | GET `/v1/me/insights`                              | yes  |
| `insights admin`                | GET `/v1/admin/insights`                           | yes  |

Run `directory --help` for the full flag list of every command.

### Examples

```sh
# Public search (table output, then --json for the raw envelope)
directory search --school acme --q "trauma" --modality somatic --online
directory --json search --school acme --q "trauma"

# Propose a profile edit (published profiles queue for human review)
directory profile edit --school acme --slug jane-doe --field headline="Now booking"
directory profile edit --school acme --slug jane-doe --json-body '{"acceptingClients":true}'

# Submit a lead
directory leads create --school acme --profile jane-doe \
  --name "Sam" --email sam@example.com --message "Looking for sessions"

# Bulk roster import (bare array or { facilitators, issueClaimLinks })
directory roster import ./roster.json --school acme --issue-claim-links

# Mint a scoped key (plaintext shown once)
directory keys create --name "crm" --scope leads:write --scope leads:read

# Clear a logo
directory branding set --logo ""
```
