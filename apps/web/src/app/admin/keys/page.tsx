import { ALL_SCOPES } from "@directory/contracts";
import { listApiKeys } from "@directory/core";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../../lib/auth-session.ts";
import { createKey, revokeKey } from "./actions.ts";

const SCOPE_HELP: Record<string, string> = {
  "directory:read": "Read schools & profiles (public data)",
  "insights:read": "Read AI insights for this school",
  "leads:write": "Submit inbound leads / contact requests",
  "profiles:write": "Edit graduate profiles (published edits go to review)",
  "roster:admin": "Bulk-import the facilitator roster",
};

/**
 * API key management — owners/admins mint org-scoped Bearer keys so external
 * agents and CRMs can authenticate to the directory. The plaintext is shown
 * exactly once (via ?new=) right after creation; we only ever store its hash.
 */
export default async function KeysPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; revoked?: string }>;
}) {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (ctx.role !== "owner" && ctx.role !== "admin") redirect("/me");
  if (!ctx.organizationId) redirect("/me");

  const keys = await listApiKeys(ctx.organizationId);
  const { new: fresh, revoked } = await searchParams;

  return (
    <div className="page">
      <div className="page-bar">
        <a href="/admin">← Back to admin</a>
      </div>
      <h1>API keys</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Authenticate external agents and CRMs with{" "}
        <code>Authorization: Bearer dk_live_…</code>. See the machine API at{" "}
        <a href="/api/docs">/api/docs</a>.
      </p>

      {fresh && (
        <div className="panel" style={{ borderColor: "var(--accent)" }}>
          <strong>Copy this key now — it won't be shown again:</strong>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              marginBottom: 0,
            }}
          >
            <code>{fresh}</code>
          </pre>
        </div>
      )}
      {revoked && (
        <p className="muted" style={{ marginTop: 0 }}>
          Key revoked.
        </p>
      )}

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Create a key</h2>
        <form action={createKey} className="stack">
          <div className="stack" style={{ gap: "var(--space-2)" }}>
            <label className="label" htmlFor="name">
              Label
            </label>
            <input
              id="name"
              name="name"
              type="text"
              className="input"
              placeholder="e.g. Acme CRM"
              maxLength={80}
            />
          </div>
          <fieldset
            className="stack"
            style={{ gap: "var(--space-2)", border: 0, padding: 0, margin: 0 }}
          >
            <legend className="label">Scopes</legend>
            {ALL_SCOPES.map((s) => (
              <label
                key={s}
                style={{ display: "flex", gap: "var(--space-2)", alignItems: "baseline" }}
              >
                <input type="checkbox" name="scopes" value={s} defaultChecked={s === "directory:read"} />
                <span>
                  <code>{s}</code> — {SCOPE_HELP[s]}
                </span>
              </label>
            ))}
          </fieldset>
          <div>
            <button type="submit" className="btn btn-primary">
              Create key
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <h2 style={{ marginTop: 0 }}>Existing keys</h2>
        {keys.length === 0 ? (
          <p className="muted">No keys yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                <th>Label</th>
                <th>Prefix</th>
                <th>Scopes</th>
                <th>Last used</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const isRevoked = k.revokedAt != null;
                const isExpired = k.expiresAt != null && k.expiresAt.getTime() < Date.now();
                return (
                  <tr key={k.id} style={{ opacity: isRevoked ? 0.5 : 1 }}>
                    <td>{k.name}</td>
                    <td>
                      <code>{k.prefix}…</code>
                    </td>
                    <td>{k.scopes.join(", ") || "—"}</td>
                    <td className="muted">
                      {isRevoked
                        ? "revoked"
                        : isExpired
                          ? "expired"
                          : k.lastUsedAt
                            ? k.lastUsedAt.toISOString().slice(0, 10)
                            : "never"}
                    </td>
                    <td>
                      {!isRevoked && (
                        <form action={revokeKey}>
                          <input type="hidden" name="keyId" value={k.id} />
                          <button type="submit" className="btn">
                            Revoke
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
