import { WEBHOOK_EVENTS } from "@directory/contracts";
import {
  listWebhookDeliveries,
  listWebhookEndpoints,
  type WebhookDeliveryRow,
} from "@directory/core";
import { Webhook } from "lucide-react";
import { redirect } from "next/navigation";

import { CodeBlock } from "../_components/CodeBlock.tsx";
import { CopyButton } from "../_components/CopyButton.tsx";
import { PageHeader } from "../_components/PageHeader.tsx";
import { getAuthContext } from "../../../lib/auth-session.ts";
import {
  createWebhook,
  deleteWebhook,
  rotateWebhook,
  sendTest,
  toggleWebhook,
} from "./actions.ts";
import { ConfirmSubmit } from "./ConfirmSubmit.tsx";
import styles from "./webhooks.module.css";

/** Node receiver snippet, drawn from docs/webhooks.md (signature verification). */
const VERIFY_SNIPPET = `import { createHmac, timingSafeEqual } from "node:crypto";

// Read the RAW body before parsing JSON — the signature is over the exact bytes.
export function verify(rawBody, header, secret) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const t = Number(parts.t);
  // Reject anything outside a 5-minute window to stop replay.
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expected = createHmac("sha256", secret)
    .update(\`\${t}.\${rawBody}\`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1 ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Express example:
app.post("/hooks/directory", express.raw({ type: "*/*" }), (req, res) => {
  const raw = req.body.toString("utf8");
  const sig = req.header("directory-signature");
  if (!verify(raw, sig, process.env.DIRECTORY_WEBHOOK_SECRET)) {
    return res.sendStatus(400);
  }
  const event = JSON.parse(raw);
  // Dedupe on req.header("directory-id") — deliveries are at-least-once.
  res.sendStatus(200);
});`;

/** Human label for what each event fires on (mirrors docs/webhooks.md). */
const EVENT_HELP: Record<string, string> = {
  "profile.claimed": "A graduate claims their profile",
  "profile.published": "A profile goes draft/hidden → published",
  "profile.updated": "Any profile edit",
  "contact.requested": 'A visitor clicks "contact" on a profile',
  "lead.created": "A lead is captured (contact click or write API)",
  "search.performed": "An agent runs a directory search",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "succeeded") {
    return <span className="badge badge-online">succeeded</span>;
  }
  if (status === "failed") {
    return <span className="badge badge-danger">failed</span>;
  }
  // pending / anything else → neutral.
  return <span className="badge badge-neutral">{status}</span>;
}

function fmtTime(d: Date): string {
  // Compact, locale-stable UTC stamp (server-rendered, no hydration drift).
  return d.toISOString().replace("T", " ").slice(0, 16) + "Z";
}

/**
 * CRM webhooks console — the single home for outbound webhooks (moved out of the
 * cramped School settings page). Owners/admins register signed HTTPS endpoints,
 * pick which directory events to receive, send a live test, rotate/disable/
 * delete, and watch a real delivery log for observability. All mutations go
 * through the co-located server actions; secrets are revealed exactly once via
 * `?secret=`. Renders as MAIN CONTENT — the admin sidebar layout supplies the
 * surrounding chrome, so this starts at the heading (no back bar / page header).
 */
export default async function WebhooksPage({
  searchParams,
}: {
  searchParams: Promise<{
    secret?: string;
    saved?: string;
    error?: string;
    tested?: string;
    ep?: string;
  }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect("/me");
  if (!ctx.organizationId) redirect("/me");

  const [endpoints, deliveries] = await Promise.all([
    listWebhookEndpoints(ctx.organizationId),
    listWebhookDeliveries(ctx.organizationId, 25),
  ]);
  const { secret, saved, error, tested, ep: testedEp } = await searchParams;

  // Map endpointId → its url, so the deliveries table can show a target column
  // even though listWebhookDeliveries only returns the endpoint id.
  const urlByEndpoint = new Map(endpoints.map((e) => [e.id, e.url] as const));

  const errorMessage =
    error === "blocked"
      ? "That endpoint must be a public https:// URL — private, loopback, and metadata addresses are blocked."
      : error === "url"
        ? "Enter a valid https:// URL."
        : error === "rotate"
          ? "Could not rotate that secret — the endpoint may have been removed."
          : null;

  return (
    <div className={styles.console}>
      <PageHeader
        eyebrow="Webhooks"
        title="CRM webhooks"
        icon={<Webhook size={22} aria-hidden />}
        intro={
          <>
            Push directory events to your CRM in real time. Each delivery is a
            signed <code>POST</code> carrying a <code>directory-signature</code>{" "}
            header (HMAC-SHA256). Register an endpoint, choose your events, and
            verify the signature on your side — the full spec lives at{" "}
            <a href="/api/docs">/api/docs</a>.
          </>
        }
      />

      {/* ── Flash + reveal-once secret ─────────────────────────────────── */}
      {secret && (
        <div className={`panel ${styles.secretBanner}`}>
          <strong>Copy this signing secret now — it won&apos;t be shown again.</strong>
          <p className="muted" style={{ margin: "var(--space-2) 0 0" }}>
            Store it in your CRM as the webhook signing secret. Lost it? Rotate
            the endpoint to mint a new one.
          </p>
          <div className={styles.secretRow}>
            <pre className={styles.secretValue}>
              <code>{secret}</code>
            </pre>
            <CopyButton value={secret} label="Copy secret" />
          </div>
        </div>
      )}
      {saved && <p className="flash flash-ok">Saved.</p>}
      {/* Test results render inline next to the row that fired them (below), so
          no redundant top banner here — just persistent error/saved notices. */}
      {errorMessage && <p className="flash flash-error">{errorMessage}</p>}

      {/* ── Add endpoint ───────────────────────────────────────────────── */}
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Add an endpoint</h2>
        <form action={createWebhook} className="stack">
          <div className="stack" style={{ gap: "var(--space-2)" }}>
            <label className="label" htmlFor="url">
              Endpoint URL
            </label>
            <input
              id="url"
              name="url"
              type="url"
              className="input"
              placeholder="https://your-crm.example/hooks/directory"
              required
            />
            <span className={styles.eventHint}>Must be a public https:// URL.</span>
          </div>

          <fieldset className={styles.eventGrid}>
            <legend className="label" style={{ marginBottom: "var(--space-3)" }}>
              Events
            </legend>
            <label className={`${styles.eventOption} ${styles.allRow}`}>
              <input type="checkbox" name="events" value="*" defaultChecked />
              <span>
                <strong>All events</strong> — receive everything, including future
                event types
              </span>
            </label>
            {WEBHOOK_EVENTS.map((e) => (
              <label key={e} className={styles.eventOption}>
                <input type="checkbox" name="events" value={e} />
                <span>
                  <code>{e}</code>
                  <br />
                  <span className={styles.eventHint}>{EVENT_HELP[e]}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="stack" style={{ gap: "var(--space-2)" }}>
            <label className="label" htmlFor="description">
              Description <span className={styles.eventHint}>(optional)</span>
            </label>
            <input
              id="description"
              name="description"
              type="text"
              className="input"
              placeholder="e.g. HubSpot production"
              maxLength={200}
            />
          </div>

          <div>
            <button type="submit" className="btn btn-primary">
              Add endpoint
            </button>
          </div>
        </form>
      </div>

      {/* ── Registered endpoints ───────────────────────────────────────── */}
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Endpoints</h2>
        {endpoints.length === 0 ? (
          <p className="muted">No endpoints yet. Add one above to start receiving events.</p>
        ) : (
          <ul className={styles.endpoints}>
            {endpoints.map((w) => (
              <li
                key={w.id}
                className={styles.endpoint}
                data-disabled={!w.enabled}
              >
                <div className={styles.endpointHead}>
                  <span className={styles.endpointUrl}>{w.url}</span>
                  <span
                    className={`badge ${w.enabled ? "badge-online" : "badge-neutral"}`}
                  >
                    {w.enabled ? "enabled" : "disabled"}
                  </span>
                </div>

                <div className={styles.eventChips}>
                  {w.events.length === 0 || w.events.includes("*") ? (
                    <span className={`${styles.eventChip} ${styles.eventChipAll}`}>
                      all events
                    </span>
                  ) : (
                    w.events.map((e) => (
                      <span key={e} className={styles.eventChip}>
                        {e}
                      </span>
                    ))
                  )}
                </div>

                {w.description && (
                  <div className={styles.endpointMeta}>{w.description}</div>
                )}
                <div className={styles.endpointMeta}>
                  Added {fmtTime(w.createdAt)}
                </div>

                <div className={`row ${styles.actions}`}>
                  {/* Primary affordance: confirm the endpoint is wired up. */}
                  <form action={sendTest}>
                    <input type="hidden" name="endpointId" value={w.id} />
                    <button type="submit" className="btn btn-sm btn-outline">
                      Send test
                    </button>
                  </form>
                  {/* Reversible toggles → low-emphasis ghost. */}
                  <form action={toggleWebhook}>
                    <input type="hidden" name="endpointId" value={w.id} />
                    <input type="hidden" name="enabled" value={String(!w.enabled)} />
                    <button type="submit" className="btn btn-sm btn-ghost">
                      {w.enabled ? "Disable" : "Enable"}
                    </button>
                  </form>
                  {/* Rotate invalidates the CRM's stored secret → confirm first. */}
                  <form action={rotateWebhook}>
                    <input type="hidden" name="endpointId" value={w.id} />
                    <ConfirmSubmit
                      className="btn btn-sm btn-ghost"
                      message={`Rotate the signing secret for ${w.url}? Your CRM will reject deliveries until you update it with the new secret.`}
                    >
                      Rotate secret
                    </ConfirmSubmit>
                  </form>
                  {/* Destructive, irreversible → danger styling + confirm. */}
                  <form action={deleteWebhook}>
                    <input type="hidden" name="endpointId" value={w.id} />
                    <ConfirmSubmit
                      className={`btn btn-sm ${styles.btnDanger}`}
                      message={`Delete the endpoint ${w.url}? This can't be undone — you'll need to re-register it (and re-add the secret to your CRM) to resume deliveries.`}
                    >
                      Delete
                    </ConfirmSubmit>
                  </form>
                  {tested && testedEp === w.id && (
                    <span
                      className={styles.testResult}
                      style={{
                        color:
                          tested === "ok"
                            ? "var(--color-online)"
                            : "var(--color-danger)",
                      }}
                    >
                      {tested === "ok" ? "✓ test sent" : "✗ test failed"}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ── Deliveries log ─────────────────────────────────────────────── */}
      <div className="panel" id="deliveries">
        <h2 style={{ marginTop: 0 }}>Recent deliveries</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          The last {deliveries.length || 25} delivery attempts. Failed deliveries
          are retried by the nightly sweep with exponential backoff.
        </p>
        {deliveries.length === 0 ? (
          <p className="muted">No deliveries yet.</p>
        ) : (
          <div className={styles.tableWrap}>
            <div className="table-card">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Endpoint</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Code</th>
                    <th>Last error</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d: WebhookDeliveryRow) => (
                    <tr key={d.id}>
                      <td className="mono">{d.eventType}</td>
                      <td className={`mono ${styles.dim}`}>
                        {urlByEndpoint.get(d.endpointId) ??
                          d.endpointId.slice(0, 8)}
                      </td>
                      <td>
                        <StatusBadge status={d.status} />
                      </td>
                      <td>{d.attempts}</td>
                      <td className="mono">{d.lastStatusCode ?? "—"}</td>
                      <td className={d.lastError ? styles.errorCell : styles.dim}>
                        {d.lastError ?? "—"}
                      </td>
                      <td className={`mono ${styles.dim}`}>
                        {fmtTime(d.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Signature verification explainer ───────────────────────────── */}
      <div className="panel">
        <h2 style={{ marginTop: 0 }}>How to verify the signature</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Every request carries{" "}
          <code>directory-signature: t=&lt;unix&gt;,v1=&lt;hmac&gt;</code>. Compute{" "}
          <code>HMAC-SHA256(secret, `${"{t}"}.${"{rawBody}"}`)</code> over the{" "}
          <strong>raw</strong> body and compare in constant time. Dedupe on the{" "}
          <code>directory-id</code> header — deliveries are at-least-once.
        </p>
        <CodeBlock code={VERIFY_SNIPPET} lang="node" />
      </div>
    </div>
  );
}
