import { ALL_SCOPES } from "@directory/contracts";
import { listApiKeys } from "@directory/core";
import {
  BookOpen,
  Boxes,
  Code2,
  KeyRound,
  Lock,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuthContext } from "../../../lib/auth-session.ts";
import { CodeBlock } from "../_components/CodeBlock.tsx";
import { CopyButton } from "../_components/CopyButton.tsx";
import { PageHeader } from "../_components/PageHeader.tsx";
import { createKey, revokeKey } from "./actions.ts";
import styles from "./developers.module.css";

/**
 * One-line help for every scope a key can carry — mirrors the SCOPES map in
 * contracts so the picker explains, in plain English, what each grant unlocks.
 */
const SCOPE_HELP: Record<string, string> = {
  "directory:read": "Read schools & practitioner profiles (public data)",
  "insights:read": "Read AI coaching insights for this school",
  "leads:write": "Submit inbound leads / contact requests",
  "leads:read": "List leads captured for this school",
  "profiles:write": "Edit graduate profiles (published edits go to review)",
  "roster:admin": "Bulk-import the facilitator roster",
  "reviews:write": "Approve / reject queued profile changes",
  "webhooks:admin": "Manage outbound webhook endpoints",
  "keys:admin": "Mint & revoke API keys (subset-mint rule applies)",
  "school:admin": "Org config: branding, subscription, graduates, metrics",
};

/**
 * The MCP tool surface, kept in lock-step with apps/mcp/src/tools.ts. Read tools
 * are public; write/insight tools need a key with the noted scope.
 */
const MCP_TOOLS: { name: string; desc: string; auth: string }[] = [
  {
    name: "search_directory",
    desc: "Search a school's certified practitioners by natural-language query, modality, and geo.",
    auth: "public",
  },
  {
    name: "get_profile",
    desc: "Fetch full detail (bio, modalities, certifications) for one practitioner.",
    auth: "public",
  },
  {
    name: "get_school",
    desc: "Fetch a school's public profile (name, branding) by slug.",
    auth: "public",
  },
  {
    name: "create_lead",
    desc: "Submit an inbound lead (contact request / booking intent / inquiry) for a school or graduate.",
    auth: "leads:write",
  },
  {
    name: "suggest_profile_edit",
    desc: "Propose a profile edit. Published profiles queue for human review; drafts apply in place.",
    auth: "profiles:write",
  },
  {
    name: "get_insights",
    desc: "Fetch the latest AI coaching insight for a graduate or the school.",
    auth: "insights:read",
  },
];

/**
 * Developers / Connect hub — the single place a school admin learns how to wire
 * machines into the directory: REST base URL + discovery, inline API-key
 * management (mint with a scope picker, reveal once, revoke), the MCP endpoint +
 * tool list + client config, the CLI, and copy-paste code samples. Gated to
 * owners/admins; every snippet is filled with the REAL deployment origin so it
 * is paste-ready. Rendered as MAIN CONTENT (an admin sidebar layout wraps it).
 */
export default async function DevelopersPage({
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

  // Same origin derivation as admin/page.tsx so every copy-paste snippet points
  // at the live deployment host (behind the proxy's x-forwarded-* headers).
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${
    h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  }`;
  const apiBase = `${origin}/api`;
  const mcpUrl = `${origin}/mcp`;
  const discoveryUrl = `${apiBase}/.well-known/ai-directory.json`;
  const openApiUrl = `${apiBase}/openapi.json`;
  const docsUrl = `${apiBase}/docs`;

  // A representative school slug for the code samples. Real value is the school's
  // public directory slug; we show a placeholder so the call shape is obvious.
  const slug = "your-school";
  const keyPlaceholder = "dk_live_xxxxxxxxxxxxxxxx";

  const mcpConfig = `{
  "mcpServers": {
    "the-directory": {
      "url": "${mcpUrl}",
      "headers": {
        "Authorization": "Bearer ${keyPlaceholder}"
      }
    }
  }
}`;

  const curlSample = `# Search a school's practitioners (public — key adds attribution)
curl -s "${apiBase}/v1/schools/${slug}/search?q=trauma&online=true" \\
  -H "Authorization: Bearer ${keyPlaceholder}"

# Submit a lead (requires leads:write)
curl -s -X POST "${apiBase}/v1/schools/${slug}/leads" \\
  -H "Authorization: Bearer ${keyPlaceholder}" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{"profileSlug":"jane-doe","contactName":"Sam","contactEmail":"sam@example.com","message":"Looking for sessions"}'`;

  const jsSample = `const BASE = "${apiBase}";
const KEY = process.env.DIRECTORY_API_KEY; // ${keyPlaceholder}

// GET — search
const res = await fetch(
  \`\${BASE}/v1/schools/${slug}/search?q=\${encodeURIComponent("trauma")}&online=true\`,
  { headers: { Authorization: \`Bearer \${KEY}\` } },
);
const { results, total } = await res.json();

// POST — create a lead (requires leads:write)
await fetch(\`\${BASE}/v1/schools/${slug}/leads\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${KEY}\`,
    "Content-Type": "application/json",
    "Idempotency-Key": crypto.randomUUID(),
  },
  body: JSON.stringify({
    profileSlug: "jane-doe",
    contactName: "Sam",
    contactEmail: "sam@example.com",
    message: "Looking for sessions",
  }),
});`;

  const pySample = `import os, uuid, requests

BASE = "${apiBase}"
KEY = os.environ["DIRECTORY_API_KEY"]  # ${keyPlaceholder}
auth = {"Authorization": f"Bearer {KEY}"}

# GET — search
r = requests.get(
    f"{BASE}/v1/schools/${slug}/search",
    params={"q": "trauma", "online": "true"},
    headers=auth,
)
results = r.json()

# POST — create a lead (requires leads:write)
requests.post(
    f"{BASE}/v1/schools/${slug}/leads",
    headers={**auth, "Idempotency-Key": str(uuid.uuid4())},
    json={
        "profileSlug": "jane-doe",
        "contactName": "Sam",
        "contactEmail": "sam@example.com",
        "message": "Looking for sessions",
    },
)`;

  const cliInstall = `# Install globally (the 'directory' binary)
npm i -g @directory/cli

# …or run without installing
npx @directory/cli search --school ${slug} --q yoga`;

  const cliEnv = `export DIRECTORY_BASE_URL="${origin}"
export DIRECTORY_API_KEY="${keyPlaceholder}"`;

  const cliExamples = `# Public search (add --json for the raw envelope)
directory search --school ${slug} --q "trauma" --modality somatic --online

# Submit a lead
directory leads create --school ${slug} --profile jane-doe \\
  --name "Sam" --email sam@example.com --message "Looking for sessions"

# Propose a profile edit (published profiles queue for review)
directory profile edit --school ${slug} --slug jane-doe --field headline="Now booking"

# Mint a scoped key (plaintext shown once)
directory keys create --name "crm" --scope leads:write --scope leads:read`;

  return (
    <div className={styles.hub}>
      {/* Shared console header — matches every other admin surface. The admin
          shell's .content already supplies the max-width + padding, so this
          renders straight into it (no extra .page wrapper / indent). */}
      <PageHeader
        eyebrow="Developers"
        title="Connect to The Directory"
        intro="Connect agents, CRMs, and your own code to your directory. One REST API, an MCP server, and a CLI — all authenticated with org-scoped keys you mint and revoke right here."
        icon={<Terminal size={24} strokeWidth={1.8} />}
      />

      {/* ── In-page nav ──────────────────────────────────────── */}
      <nav className={styles.nav} aria-label="Developer sections">
        <a className={styles.navLink} href="#overview">
          <BookOpen size={15} /> Overview
        </a>
        <a className={styles.navLink} href="#keys">
          <KeyRound size={15} /> API keys
        </a>
        <a className={styles.navLink} href="#mcp">
          <Boxes size={15} /> MCP
        </a>
        <a className={styles.navLink} href="#cli">
          <Terminal size={15} /> CLI
        </a>
        <a className={styles.navLink} href="#code">
          <Code2 size={15} /> Code samples
        </a>
      </nav>

      {/* ── 1. Overview / connection essentials ──────────────── */}
      <section id="overview" className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionIcon}>
            <BookOpen size={20} strokeWidth={1.8} />
          </span>
          <h2>Connection essentials</h2>
        </div>
        <p className={styles.sectionSub}>
          Everything machine-facing is based at{" "}
          <code>{"<origin>/api"}</code>. Agents can auto-discover the API from
          the well-known doc, or read the OpenAPI schema directly.
        </p>

        <div className={styles.essentials}>
          <div className={styles.essential}>
            <span className={styles.essentialLabel}>REST base URL</span>
            <div className={styles.essentialValue}>
              <code>{apiBase}</code>
              <CopyButton value={apiBase} label="Copy" />
            </div>
          </div>
          <div className={styles.essential}>
            <span className={styles.essentialLabel}>MCP endpoint</span>
            <div className={styles.essentialValue}>
              <code>{mcpUrl}</code>
              <CopyButton value={mcpUrl} label="Copy" />
            </div>
          </div>
          <div className={styles.essential}>
            <span className={styles.essentialLabel}>Discovery & schema</span>
            <div className={styles.essentialLinks}>
              <a className="btn btn-outline btn-sm" href={discoveryUrl} target="_blank" rel="noreferrer">
                ai-directory.json
              </a>
              <a className="btn btn-outline btn-sm" href={openApiUrl} target="_blank" rel="noreferrer">
                OpenAPI
              </a>
              <a className="btn btn-outline btn-sm" href={docsUrl} target="_blank" rel="noreferrer">
                API docs
              </a>
            </div>
          </div>
        </div>

        <div className={styles.authNote} style={{ marginTop: "var(--space-4)" }}>
          <ShieldCheck size={20} strokeWidth={1.9} style={{ flex: "0 0 auto", marginTop: 1 }} />
          <p>
            <strong>How machine auth works.</strong> Mint an org-scoped key
            below — it looks like <code>dk_live_…</code> — and send it on every
            request as <code>Authorization: Bearer dk_live_…</code>. Each key
            carries a set of <strong>scopes</strong> (e.g.{" "}
            <code>leads:write</code>) that gate what it can do. Public reads
            need no key; a key still adds attribution. Plaintext is shown{" "}
            <em>once</em> at creation and stored only as a hash.
          </p>
        </div>
      </section>

      <hr className="divider" />

      {/* ── 2. API keys (inline management) ──────────────────── */}
      <section id="keys" className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionIcon}>
            <KeyRound size={20} strokeWidth={1.8} />
          </span>
          <h2>API keys</h2>
        </div>
        <p className={styles.sectionSub}>
          Mint keys for each integration and grant only the scopes it needs.
          Revoke instantly if a key leaks.
        </p>

        {fresh && (
          <>
            <p className="flash flash-ok">Key created.</p>
            <div className={styles.revealBanner}>
              <strong>Copy this key now — it won&apos;t be shown again:</strong>
              <div className={styles.revealRow}>
                <pre className={styles.revealKey}>
                  <code>{fresh}</code>
                </pre>
                <CopyButton value={fresh} label="Copy key" />
              </div>
            </div>
          </>
        )}
        {revoked && <p className="flash flash-ok">Key revoked.</p>}

        <div className="panel">
          <h3 style={{ marginTop: 0, fontSize: "var(--fs-h3)" }}>Create a key</h3>
          <form action={createKey} className="stack">
            <div className="stack" style={{ gap: "var(--space-2)" }}>
              <label className="label" htmlFor="key-name">
                Label
              </label>
              <input
                id="key-name"
                name="name"
                type="text"
                className="input"
                placeholder="e.g. Acme CRM"
                maxLength={80}
              />
            </div>
            <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="label" style={{ marginBottom: "var(--space-3)" }}>
                Scopes
              </legend>
              <div className={styles.scopeGrid}>
                {ALL_SCOPES.map((s) => (
                  <label key={s} className={styles.scope}>
                    <input
                      type="checkbox"
                      name="scopes"
                      value={s}
                      defaultChecked={s === "directory:read"}
                    />
                    <span className={styles.scopeText}>
                      <code>{s}</code>
                      <span className={styles.scopeHelp}>{SCOPE_HELP[s]}</span>
                    </span>
                  </label>
                ))}
              </div>
              <p className={styles.scopeNote}>
                A key needs at least one scope to be useful. If you clear them
                all, <code>directory:read</code> (public reads) is granted by
                default so the key can still authenticate.
              </p>
            </fieldset>
            <div>
              <button type="submit" className="btn btn-primary">
                Create key
              </button>
            </div>
          </form>
        </div>

        <div className="panel" style={{ marginTop: "var(--space-4)" }}>
          <h3 style={{ marginTop: 0, fontSize: "var(--fs-h3)" }}>Existing keys</h3>
          {keys.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No keys yet. Create one above to start connecting.
            </p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Prefix</th>
                    <th>Scopes</th>
                    <th>Last used</th>
                    <th>Created</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => {
                    const isRevoked = k.revokedAt != null;
                    const isExpired =
                      k.expiresAt != null && k.expiresAt.getTime() < Date.now();
                    return (
                      <tr key={k.id} className={isRevoked ? styles.rowRevoked : undefined}>
                        <td>{k.name}</td>
                        <td>
                          <code>{k.prefix}…</code>
                        </td>
                        <td>
                          {k.scopes.length === 0 ? (
                            <span className="muted">—</span>
                          ) : (
                            <div className={styles.chipRow}>
                              {k.scopes.map((s) => (
                                <span key={s} className={styles.scopeChip}>
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="muted">
                          {isRevoked
                            ? "revoked"
                            : isExpired
                              ? "expired"
                              : k.lastUsedAt
                                ? k.lastUsedAt.toISOString().slice(0, 10)
                                : "never"}
                        </td>
                        <td className="muted">{k.createdAt.toISOString().slice(0, 10)}</td>
                        <td style={{ textAlign: "right" }}>
                          {!isRevoked && (
                            <form action={revokeKey}>
                              <input type="hidden" name="keyId" value={k.id} />
                              <button type="submit" className="btn btn-sm">
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
            </div>
          )}
        </div>
      </section>

      <hr className="divider" />

      {/* ── 3. MCP ───────────────────────────────────────────── */}
      <section id="mcp" className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionIcon}>
            <Boxes size={20} strokeWidth={1.8} />
          </span>
          <h2>MCP server</h2>
        </div>
        <p className={styles.sectionSub}>
          The Model Context Protocol server lets AI clients (Claude Desktop,
          Cursor, …) call your directory as native tools over streamable HTTP.
          Authenticate the transport with a Bearer key — read tools are public,
          write tools need the matching scope.
        </p>

        <div className={styles.essential} style={{ marginBottom: "var(--space-4)" }}>
          <span className={styles.essentialLabel}>MCP endpoint</span>
          <div className={styles.essentialValue}>
            <code>{mcpUrl}</code>
            <CopyButton value={mcpUrl} label="Copy" />
          </div>
        </div>

        <h3 style={{ fontSize: "var(--fs-h3)" }}>Tools</h3>
        <div className={styles.toolGrid}>
          {MCP_TOOLS.map((t) => (
            <div key={t.name} className={styles.tool}>
              <span className={styles.toolName}>{t.name}</span>
              <p className={styles.toolDesc}>{t.desc}</p>
              <span
                className={styles.toolAuth}
                style={{ alignSelf: "flex-start" }}
              >
                {t.auth === "public" ? (
                  <span className="badge badge-online">public</span>
                ) : (
                  <span className={`badge badge-neutral ${styles.scopeBadge}`}>
                    <Lock size={11} strokeWidth={2.2} />
                    {t.auth}
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>

        <h3 style={{ fontSize: "var(--fs-h3)", marginTop: "var(--space-6)" }}>
          Client config
        </h3>
        <p className={styles.sectionSub} style={{ marginTop: 0 }}>
          Drop this into your MCP client (Claude Desktop / Cursor). Replace the
          placeholder with a key you minted above.
        </p>
        <CodeBlock code={mcpConfig} lang="json" />
      </section>

      <hr className="divider" />

      {/* ── 4. CLI ───────────────────────────────────────────── */}
      <section id="cli" className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionIcon}>
            <Terminal size={20} strokeWidth={1.8} />
          </span>
          <h2>Command-line tool</h2>
        </div>
        <p className={styles.sectionSub}>
          <code>@directory/cli</code> is a thin, zero-dependency HTTP client
          over the same REST API — handy for scripts, CI, and one-off ops.
        </p>

        <div className={styles.steps}>
          <div className={styles.step}>
            <span className={styles.stepNum}>1</span>
            <div className={styles.stepBody}>
              <p>Install the CLI (or run it on demand with npx).</p>
              <CodeBlock code={cliInstall} lang="bash" />
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>2</span>
            <div className={styles.stepBody}>
              <p>
                Point it at your deployment and a key. Flags override env —{" "}
                <code>DIRECTORY_BASE_URL</code> and <code>DIRECTORY_API_KEY</code>.
              </p>
              <CodeBlock code={cliEnv} lang="bash" />
            </div>
          </div>
          <div className={styles.step}>
            <span className={styles.stepNum}>3</span>
            <div className={styles.stepBody}>
              <p>Run commands. Public commands work without a key.</p>
              <CodeBlock code={cliExamples} lang="bash" />
            </div>
          </div>
        </div>
      </section>

      <hr className="divider" />

      {/* ── 5. Code samples ──────────────────────────────────── */}
      <section id="code" className={styles.section}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionIcon}>
            <Code2 size={20} strokeWidth={1.8} />
          </span>
          <h2>Code samples</h2>
        </div>
        <p className={styles.sectionSub}>
          The same two calls — GET a search and POST a lead — in three runtimes,
          pre-filled with your base URL. Swap in a real key and school slug.
        </p>

        <div className={styles.samples}>
          <div className={styles.sample}>
            <div className={styles.sampleHead}>
              <h3>curl</h3>
            </div>
            <CodeBlock code={curlSample} lang="bash" />
          </div>
          <div className={styles.sample}>
            <div className={styles.sampleHead}>
              <h3>JavaScript (fetch)</h3>
            </div>
            <CodeBlock code={jsSample} lang="javascript" />
          </div>
          <div className={styles.sample}>
            <div className={styles.sampleHead}>
              <h3>Python (requests)</h3>
            </div>
            <CodeBlock code={pySample} lang="python" />
          </div>
        </div>
      </section>
    </div>
  );
}
