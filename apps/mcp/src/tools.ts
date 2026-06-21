import { capture } from "@directory/analytics";
import { LeadCreate, ProfileUpdate, SCOPES, SearchQuery } from "@directory/contracts";
import {
  createLead,
  emit,
  enqueueReview,
  getProfileDetail,
  getProfileForWrite,
  getSchoolBySlug,
  latestInsightDTO,
  LeadError,
  searchDirectory,
  updateProfile,
  verifyApiKey,
  type ScopedKey,
} from "@directory/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { z } from "zod";

/**
 * The Directory's MCP tools — the "agents as customers" surface — registered on
 * an McpServer. Shared by BOTH the standalone Node server (apps/mcp/src/index.ts,
 * for a Render/long-lived deploy) and the Next.js streamable-HTTP route
 * (apps/web .../mcp/route.ts, for the single-Vercel deploy).
 *
 * Tools call `@directory/core` DIRECTLY (not over HTTP). Going through the REST
 * API would mean a same-origin self-fetch that 401s behind Vercel Deployment
 * Protection — the same trap that broke the SSR pages. Calling core is also one
 * less hop and shares the lazy DB pool. Tenant scoping is by `organization_id`,
 * resolved from the public `schoolSlug`; agent activity is tagged actor=agent in
 * the analytics spine that feeds the nightly intelligence loop.
 */

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

const ok = (data: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});

const fail = (message: string): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify({ error: message }) }],
  isError: true,
});

/**
 * ── Machine auth for the write surface ────────────────────────────────────────
 * Read tools stay public. Write/insight tools require a first-party org-scoped
 * API key (dk_live_…), resolved to {organizationId, scopes, keyId} the same way
 * the REST tenant() middleware does — verifyApiKey calls core directly. The token
 * is read from the MCP request's HTTP headers (preferred) or an apiKey arg
 * (fallback for transports that can't set headers). The token is NEVER logged.
 */
class McpAuthError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "McpAuthError";
  }
}

/**
 * Resolve a caller to a ScopedKey from the Bearer header (preferred) or an
 * `apiKey` arg (fallback). MCP/streamable-http lowercases header keys, so read
 * `authorization`; a value may be string | string[]. Returns null when no
 * directory key is present, so callers can answer "authentication required".
 */
async function resolveAuth(
  extra: RequestHandlerExtra<any, any> | undefined,
  args: { apiKey?: string },
): Promise<ScopedKey | null> {
  const headers = extra?.requestInfo?.headers;
  const raw = headers?.["authorization"] ?? headers?.["Authorization"];
  const headerValue = Array.isArray(raw) ? raw[0] : raw;
  const fromHeader = headerValue?.replace(/^Bearer\s+/i, "");
  const token = fromHeader || args.apiKey;
  if (!token || !token.startsWith("dk_")) return null;
  // NEVER log `token`.
  return verifyApiKey(token);
}

function assertScope(key: ScopedKey, scope: string): void {
  if (!key.scopes.includes(scope))
    throw new McpAuthError(`missing required scope: ${scope}`, "insufficient_scope");
}

/**
 * Gate a tool body on auth + a scope. Resolves the key, enforces the scope, then
 * runs `fn(key)`; any auth failure becomes an isError ToolResult (never a throw)
 * so agents get a clean, structured reason.
 */
async function withAuth(
  extra: RequestHandlerExtra<any, any> | undefined,
  args: { apiKey?: string },
  scope: string,
  fn: (key: ScopedKey) => Promise<ToolResult>,
): Promise<ToolResult> {
  const key = await resolveAuth(extra, args);
  if (!key)
    return fail(
      "authentication required: pass Authorization: Bearer dk_live_… (or apiKey arg)",
    );
  try {
    assertScope(key, scope);
  } catch (err) {
    return fail((err as Error).message);
  }
  return fn(key);
}

/** Shared `apiKey` input field for the authed tools (header is still preferred). */
const authArg = {
  apiKey: z
    .string()
    .optional()
    .describe(
      "Org-scoped API key (dk_live_…). FALLBACK ONLY — prefer the Authorization: Bearer header. Sensitive; do not echo.",
    ),
};

export function registerDirectoryTools(server: McpServer): void {
  server.registerTool(
    "search_directory",
    {
      title: "Search the directory",
      description:
        "Search a school's certified practitioners by natural-language query, modality, and geo. Public — no auth.",
      inputSchema: {
        schoolSlug: z
          .string()
          .describe("The school's directory slug, e.g. breathwork-global"),
        q: z.string().optional().describe("Natural-language query (semantic search)"),
        modality: z.string().optional().describe("Modality slug filter"),
        lat: z.number().optional(),
        lng: z.number().optional(),
        radiusKm: z.number().optional(),
        online: z.boolean().optional(),
      },
    },
    async (args) => {
      const school = await getSchoolBySlug(args.schoolSlug);
      if (!school) return fail(`school not found: ${args.schoolSlug}`);

      const parsed = SearchQuery.safeParse(args);
      const query = parsed.success ? parsed.data : SearchQuery.parse({});
      const result = await searchDirectory(school.id, query);

      void capture({
        organizationId: school.id,
        eventType: "search",
        actor: "agent",
        props: { q: args.q, modality: args.modality },
      }).catch(() => {});
      void capture({
        organizationId: school.id,
        eventType: "agent_query",
        actor: "agent",
      }).catch(() => {});

      return ok(result);
    },
  );

  server.registerTool(
    "get_profile",
    {
      title: "Get a practitioner profile",
      description:
        "Fetch full detail (bio, modalities, certifications) for one practitioner. Public — no auth.",
      inputSchema: {
        schoolSlug: z.string().describe("The school's directory slug"),
        profileSlug: z.string().describe("The practitioner's profile slug"),
      },
    },
    async (args) => {
      const school = await getSchoolBySlug(args.schoolSlug);
      if (!school) return fail(`school not found: ${args.schoolSlug}`);

      const profile = await getProfileDetail(school.id, args.profileSlug);
      if (!profile) return fail(`profile not found: ${args.profileSlug}`);

      void capture({
        organizationId: school.id,
        eventType: "profile_view",
        profileId: profile.id,
        actor: "agent",
      }).catch(() => {});

      return ok(profile);
    },
  );

  server.registerTool(
    "get_school",
    {
      title: "Get a school",
      description:
        "Fetch a school's public profile (name, branding) by slug. Public — no auth.",
      inputSchema: {
        schoolSlug: z.string().describe("The school's directory slug"),
      },
    },
    async (args) => {
      const school = await getSchoolBySlug(args.schoolSlug);
      if (!school) return fail(`school not found: ${args.schoolSlug}`);
      // Strip the internal org id; expose only the public projection.
      const { id: _id, ...pub } = school;
      return ok(pub);
    },
  );

  server.registerTool(
    "create_lead",
    {
      title: "Create a lead",
      description:
        "Submit an inbound lead (contact request / booking intent / inquiry) for a school or one of its graduates. Requires an org-scoped key with leads:write.",
      inputSchema: {
        schoolSlug: z.string().describe("The school's directory slug"),
        profileSlug: z
          .string()
          .optional()
          .describe("Target a specific graduate; omit for a school-level lead"),
        contactName: z.string().optional(),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().optional(),
        message: z.string().optional(),
        kind: z
          .enum(["contact_request", "booking_intent", "inquiry"])
          .optional()
          .describe("Lead type (default contact_request)"),
        source: z.string().optional().describe('Origin tag, e.g. "crm:hubspot"'),
        ...authArg,
      },
    },
    async (args, extra) =>
      withAuth(extra, args, SCOPES.leadsWrite, async (key) => {
        const school = await getSchoolBySlug(args.schoolSlug);
        if (!school) return fail(`school not found: ${args.schoolSlug}`);
        // IDOR guard: the token's org must own the school in the path.
        if (school.id !== key.organizationId)
          return fail("token not authorized for this school");

        const parsed = LeadCreate.safeParse(args);
        if (!parsed.success)
          return fail(`invalid lead: ${JSON.stringify(parsed.error.flatten())}`);

        let profileId: string | undefined;
        if (parsed.data.profileSlug) {
          const p = await getProfileForWrite(school.id, parsed.data.profileSlug);
          if (!p) return fail(`profile not found: ${parsed.data.profileSlug}`);
          profileId = p.id;
        }

        try {
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
            submittedBy: key.keyId,
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
            data: {
              leadId: lead.id,
              profileId,
              kind: parsed.data.kind,
              source: parsed.data.source,
            },
          });
          return ok({
            id: lead.id,
            kind: parsed.data.kind ?? "contact_request",
            status: "new",
            createdAt: lead.createdAt,
          });
        } catch (err) {
          if (err instanceof LeadError) return fail(err.message);
          throw err;
        }
      }),
  );

  server.registerTool(
    "suggest_profile_edit",
    {
      title: "Suggest a profile edit",
      description:
        "Propose an edit to a graduate profile. Edits to a PUBLISHED profile are queued for human review; draft/hidden profiles are updated in place. Requires profiles:write.",
      inputSchema: {
        schoolSlug: z.string().describe("The school's directory slug"),
        profileSlug: z.string().describe("The graduate's profile slug"),
        patch: z
          .object({
            headline: z.string().optional(),
            bio: z.string().optional(),
            pricing: z.record(z.unknown()).optional(),
            links: z.record(z.string()).optional(),
            acceptingClients: z.boolean().optional(),
            theme: z.record(z.unknown()).optional(),
            status: z.enum(["draft", "published", "hidden"]).optional(),
          })
          .passthrough()
          .describe("Fields to change"),
        ...authArg,
      },
    },
    async (args, extra) =>
      withAuth(extra, args, SCOPES.profilesWrite, async (key) => {
        const school = await getSchoolBySlug(args.schoolSlug);
        if (!school) return fail(`school not found: ${args.schoolSlug}`);
        if (school.id !== key.organizationId)
          return fail("token not authorized for this school");

        const parsed = ProfileUpdate.safeParse(args.patch);
        if (!parsed.success)
          return fail(`invalid patch: ${JSON.stringify(parsed.error.flatten())}`);

        const target = await getProfileForWrite(school.id, args.profileSlug);
        if (!target) return fail(`profile not found: ${args.profileSlug}`);

        if (target.status === "published") {
          const reviewId = await enqueueReview({
            organizationId: school.id,
            profileId: target.id,
            kind: "profile_change_suggestion",
            proposedBy: "agent",
            payload: parsed.data,
          });
          return ok({ queued: true, reviewId });
        }

        await updateProfile(school.id, target.id, parsed.data);
        return ok({ ok: true });
      }),
  );

  server.registerTool(
    "get_insights",
    {
      title: "Get AI insights",
      description:
        "Fetch the latest AI coaching insight for a graduate (profileSlug) or the school (omit profileSlug). Requires insights:read.",
      inputSchema: {
        schoolSlug: z.string().describe("The school's directory slug"),
        profileSlug: z
          .string()
          .optional()
          .describe("Graduate to read; omit for the school-level insight"),
        ...authArg,
      },
    },
    // Safe re-introduction of get_insights: never accept a raw profileId — only a
    // profileSlug, resolved org-scoped, so a key cannot read another tenant's
    // private coaching insights.
    async (args, extra) =>
      withAuth(extra, args, SCOPES.insightsRead, async (key) => {
        const school = await getSchoolBySlug(args.schoolSlug);
        if (!school) return fail(`school not found: ${args.schoolSlug}`);
        if (school.id !== key.organizationId)
          return fail("token not authorized for this school");

        let insight;
        if (args.profileSlug) {
          const p = await getProfileForWrite(school.id, args.profileSlug);
          if (!p) return fail(`profile not found: ${args.profileSlug}`);
          insight = await latestInsightDTO(key.organizationId, "graduate", p.id);
        } else {
          insight = await latestInsightDTO(key.organizationId, "school", null);
        }
        if (!insight) return fail("no insight yet — run the nightly loop");
        return ok(insight);
      }),
  );
}
