import { registerDirectoryTools } from "@directory/mcp/tools";
import { createMcpHandler } from "mcp-handler";

/**
 * The Directory's MCP server over streamable HTTP, mounted in the single-Vercel
 * deploy at `<origin>/mcp`. This is the "agents as customers" surface: any
 * external MCP client (Claude, an agent SDK, etc.) can discover it via
 * `/api/.well-known/ai-directory.json` and call the tools.
 *
 * Stateless (no session id, no Redis) — each POST is an independent JSON-RPC
 * exchange, which is all the discovery tools need and the right fit for
 * serverless. Tools come from `@directory/mcp/tools` and call `@directory/core`
 * directly (shared with the standalone Render server). Needs the Node runtime
 * for the Postgres pool.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const handler = createMcpHandler(
  (server) => registerDirectoryTools(server),
  {},
  { basePath: "", disableSse: true, maxDuration: 60 },
);

export { handler as GET, handler as POST };
