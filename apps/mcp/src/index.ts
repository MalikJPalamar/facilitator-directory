import { createServer, type IncomingMessage } from "node:http";

import { env } from "@directory/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { registerDirectoryTools } from "./tools.ts";

/**
 * The Directory's remote MCP server — the "agents as customers" surface — as a
 * standalone long-lived Node service (for a Render/Fly deploy). The single-Vercel
 * deploy serves the same tools from a Next route (apps/web .../mcp/route.ts);
 * both share `registerDirectoryTools`, which calls `@directory/core` directly.
 *
 * Discovery tools (search_directory, get_profile) are the public agent surface;
 * get_insights is scoped to a graduate.
 */
function buildServer(): McpServer {
  const server = new McpServer({
    name: "the-directory",
    version: "0.1.0",
  });
  registerDirectoryTools(server);
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
