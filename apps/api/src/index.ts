import { serve } from "@hono/node-server";
import { env } from "@directory/config";

import { app } from "./app.ts";

/**
 * Standalone Node server entry (local dev + Render). The single-Vercel deploy
 * does NOT use this file — it mounts `app` directly via a Next route handler.
 * Routes are based at `/api` (see app.ts), so locally they live at
 * http://localhost:8787/api/v1/...
 */
serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}/api  (docs: /api/docs)`);
});

export { app };
