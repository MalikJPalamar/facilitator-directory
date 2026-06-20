import { capture } from "@directory/analytics";
import { SearchQuery } from "@directory/contracts";
import {
  getProfileDetail,
  getSchoolBySlug,
  latestInsightDTO,
  searchDirectory,
} from "@directory/core";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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
    "get_insights",
    {
      title: "Get a graduate's AI insights",
      description:
        "Latest AI coaching insight for a graduate. Scoped — requires organizationId + profileId (derived from the OAuth token in production).",
      inputSchema: {
        organizationId: z.string().describe("Tenant/organization id"),
        profileId: z.string().describe("Graduate profile id"),
      },
    },
    async (args) => {
      const insight = await latestInsightDTO(
        args.organizationId,
        "graduate",
        args.profileId,
      );
      if (!insight) return fail("no insight yet for that profile");
      return ok(insight);
    },
  );
}
