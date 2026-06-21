# Outbound webhooks

The Directory pushes events to your CRM (or any HTTPS endpoint) so you can react
to demand and roster changes in real time. Register endpoints at
**Admin → School settings → CRM webhooks**.

## Events

| Event               | Fires when                                                        |
| ------------------- | ----------------------------------------------------------------- |
| `profile.claimed`   | A graduate claims their profile via a claim link                  |
| `profile.published` | A profile transitions draft/hidden → published                   |
| `profile.updated`   | Any profile edit                                                  |
| `contact.requested` | A visitor clicks "contact" on a profile                          |
| `lead.created`      | A lead is captured (contact click **or** the write API)          |
| `search.performed`  | An **agent** runs a directory search (human searches are not sent) |

Select a subset per endpoint, or select none to receive **all** events.

## Payload

`POST` with `content-type: application/json`:

```json
{
  "id": "1f0c…",            // event id — your idempotency key
  "type": "lead.created",
  "occurredAt": "2026-06-21T12:00:00.000Z",
  "organizationId": "org_…",
  "data": { "leadId": "…", "profileId": "…", "kind": "contact_request" }
}
```

Headers:

- `directory-signature: t=<unix>,v1=<hex>` — HMAC-SHA256 (see below)
- `directory-id: <event id>` — the same `id` as the body; **dedupe on this**
- `directory-event: <event type>`

## Verifying the signature

The signature is HMAC-SHA256 over `` `${timestamp}.${rawBody}` `` using your
endpoint's signing secret (`whsec_…`, shown once at creation; rotate any time).
Always read the **raw** request body before parsing JSON.

```ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function verify(rawBody: string, header: string, secret: string): boolean {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false; // 5-min tolerance
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1 ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}
```

## Delivery semantics

- **At-least-once.** A live attempt fires immediately; anything that doesn't get
  a `2xx` is retried by the nightly sweep with exponential backoff (~1m, 5m, 30m,
  2h, 6h) up to 6 attempts. Duplicates are possible — **dedupe on `directory-id`**.
- **Signed & timestamped.** Reject deliveries whose timestamp is outside your
  tolerance window to prevent replay.
- **HTTPS only.** Endpoints must be `https://`.
