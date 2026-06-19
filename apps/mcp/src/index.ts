import { createServer, type IncomingMessage } from "node:http";

import { env } from "@directory/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

/**
 * The Directory's remote MCP server — the "agents as customers" surface.
 *
 * It is a thin wrapper over the REST API: every tool forwards to `apps/api`
 * (with `x-actor: agent`, so agent activity is captured in the analytics spine).
 * The API enforces authz + tenant scoping exactly once, so MCP can never bypass
 * the same checks. In production the OAuth dance runs against Better Auth (the
 * authorization server) and the validated token is forwarded as the Bearer; here
 * we forward the equivalent context headers.
 *
 * Discovery tools (search_directory, get_profile) are the public agent surface.
 * get_insights is scoped to a graduate.
 */
const API = env.API_BASE_URL;

async function apiGet(path: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "x-actor": "agent", ...headers },
  });
  if (!res.ok) {
    return { error: `HTTP ${res.status}`, body: await res.text() };
  }
  return res.json();
}

function buildServer(): McpServer {
  const server = new McpServer({
    name: "the-directory",
    version: "0.1.0",
  });

  server.tool(
    "search_directory",
    {
      schoolSlug: z.string().describe("The school's directory slug, e.g. breathwork-global"),
      q: z.string().optional().describe("Natural-language query (semantic search)"),
      modality: z.string().optional().describe("Modality slug filter"),
      lat: z.number().optional(),
      lng: z.number().optional(),
      radiusKm: z.number().optional(),
      online: z.boolean().optional(),
    },
    async (args) => {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(args)) {
        if (k === "schoolSlug" || v === undefined) continue;
        params.set(k, String(v));
      }
      const data = await apiGet(
        `/v1/schools/${args.schoolSlug}/search?${params.toString()}`,
      );
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "get_profile",
    {
      schoolSlug: z.string(),
      profileSlug: z.string(),
    },
    async (args) => {
      const data = await apiGet(
        `/v1/schools/${args.schoolSlug}/profiles/${args.profileSlug}`,
      );
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  server.tool(
    "get_insights",
    {
      organizationId: z.string().describe("Tenant id (from the OAuth token in production)"),
      profileId: z.string().describe("Graduate profile id"),
    },
    async (args) => {
      const data = await apiGet(`/v1/me/insights`, {
        "x-org-id": args.organizationId,
        "x-graduate-profile-id": args.profileId,
      });
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  );

  return server;
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return undefined;
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

// Stateless streamable-HTTP MCP endpoint at POST /mcp.
const httpServer = createServer(async (req, res) => {
  if (req.url?.startsWith("/mcp") && req.method === "POST") {
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, await readBody(req));
    return;
  }
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404).end();
});

httpServer.listen(env.MCP_PORT, () => {
  console.log(`[mcp] streamable-http server on http://localhost:${env.MCP_PORT}/mcp`);
});
