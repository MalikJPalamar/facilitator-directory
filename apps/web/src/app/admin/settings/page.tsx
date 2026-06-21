import { WEBHOOK_EVENTS } from "@directory/contracts";
import { getOrganizationBranding, listWebhookEndpoints } from "@directory/core";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../../lib/auth-session.ts";
import {
  createWebhook,
  deleteWebhook,
  rotateWebhook,
  toggleWebhook,
  updateBranding,
} from "./actions.ts";

/**
 * School branding editor — owners/admins set the name, logo, theme color, and
 * hero copy that the public directory renders for their school. Gated to the
 * session's organization. Also hosts the CRM webhook registration panel.
 */
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    webhook_secret?: string;
    webhook_saved?: string;
    webhook_error?: string;
  }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect("/me");
  if (!ctx.organizationId) redirect("/me");

  const branding = await getOrganizationBranding(ctx.organizationId);
  const webhooks = await listWebhookEndpoints(ctx.organizationId);
  const {
    saved,
    webhook_secret: webhookSecret,
    webhook_saved: webhookSaved,
    webhook_error: webhookError,
  } = await searchParams;

  return (
    <div className="page">
      <div className="page-bar">
        <a href="/admin">← Back to admin</a>
      </div>
      <h1>School branding</h1>

      {saved && (
        <p className="muted" style={{ marginTop: 0 }}>
          Saved.
        </p>
      )}

      <div className="panel">
        <form action={updateBranding} className="stack">
          <div className="stack" style={{ gap: "var(--space-2)" }}>
            <label className="label" htmlFor="name">
              School name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              className="input"
              defaultValue={branding?.name ?? ""}
              maxLength={120}
            />
          </div>

          <div className="stack" style={{ gap: "var(--space-2)" }}>
            <label className="label" htmlFor="logo">
              Logo URL
            </label>
            <input
              id="logo"
              name="logo"
              type="text"
              className="input"
              placeholder="https://…"
              defaultValue={branding?.logo ?? ""}
            />
          </div>

          <div className="stack" style={{ gap: "var(--space-2)" }}>
            <label className="label" htmlFor="themeColor">
              Theme color
            </label>
            <input
              id="themeColor"
              name="themeColor"
              type="text"
              className="input"
              placeholder="#3B7A8C"
              defaultValue={branding?.themeColor ?? ""}
              maxLength={32}
            />
          </div>

          <div className="stack" style={{ gap: "var(--space-2)" }}>
            <label className="label" htmlFor="heroCopy">
              Hero copy
            </label>
            <textarea
              id="heroCopy"
              name="heroCopy"
              className="input"
              rows={3}
              maxLength={240}
              defaultValue={branding?.heroCopy ?? ""}
            />
          </div>

          <div>
            <button type="submit" className="btn btn-primary">
              Save branding
            </button>
          </div>
        </form>
      </div>

      <h2>CRM webhooks</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Push directory events to your CRM. Each delivery is signed with{" "}
        <code>directory-signature</code> (HMAC-SHA256). See{" "}
        <a href="/api/docs">/api/docs</a>.
      </p>

      {webhookSecret && (
        <div className="panel" style={{ borderColor: "var(--accent)" }}>
          <strong>Copy this signing secret now — it won't be shown again:</strong>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", marginBottom: 0 }}>
            <code>{webhookSecret}</code>
          </pre>
        </div>
      )}
      {webhookSaved && (
        <p className="muted" style={{ marginTop: 0 }}>
          Saved.
        </p>
      )}
      {webhookError && (
        <p className="muted" style={{ marginTop: 0 }}>
          Could not save webhook — check the URL is https://.
        </p>
      )}

      <div className="panel">
        <form action={createWebhook} className="stack">
          <div className="stack" style={{ gap: "var(--space-2)" }}>
            <label className="label" htmlFor="url">
              Endpoint URL (https)
            </label>
            <input
              id="url"
              name="url"
              type="url"
              className="input"
              placeholder="https://your-crm.example/hooks/directory"
              required
            />
          </div>
          <fieldset
            className="stack"
            style={{ gap: "var(--space-2)", border: 0, padding: 0, margin: 0 }}
          >
            <legend className="label">Events (none selected = all)</legend>
            {WEBHOOK_EVENTS.map((e) => (
              <label
                key={e}
                style={{ display: "flex", gap: "var(--space-2)", alignItems: "baseline" }}
              >
                <input type="checkbox" name="events" value={e} />
                <code>{e}</code>
              </label>
            ))}
          </fieldset>
          <div>
            <button type="submit" className="btn btn-primary">
              Add webhook
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>Registered endpoints</h3>
        {webhooks.length === 0 ? (
          <p className="muted">None yet.</p>
        ) : (
          <ul className="stack" style={{ listStyle: "none", padding: 0 }}>
            {webhooks.map((w) => (
              <li
                key={w.id}
                className="stack"
                style={{ gap: "var(--space-2)", paddingBottom: "var(--space-3)" }}
              >
                <div>
                  <code>{w.url}</code>{" "}
                  <span className="muted">— {w.enabled ? "enabled" : "disabled"}</span>
                </div>
                <div className="muted">
                  {w.events.length ? w.events.join(", ") : "all events"}
                </div>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <form action={toggleWebhook}>
                    <input type="hidden" name="endpointId" value={w.id} />
                    <input type="hidden" name="enabled" value={String(!w.enabled)} />
                    <button type="submit" className="btn">
                      {w.enabled ? "Disable" : "Enable"}
                    </button>
                  </form>
                  <form action={rotateWebhook}>
                    <input type="hidden" name="endpointId" value={w.id} />
                    <button type="submit" className="btn">
                      Rotate secret
                    </button>
                  </form>
                  <form action={deleteWebhook}>
                    <input type="hidden" name="endpointId" value={w.id} />
                    <button type="submit" className="btn">
                      Delete
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
