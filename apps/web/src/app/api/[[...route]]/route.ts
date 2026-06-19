import { app } from "@directory/api/app";
import { handle } from "hono/vercel";

/**
 * Mounts the Directory's Hono REST API inside the Next.js app, so a single
 * Vercel deployment serves both the UI and the API (based at /api). External
 * consumers — agents, the Web Component embed, WordPress — point at
 * `<origin>/api`. Needs the Node runtime (Postgres, Stripe, etc.).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handler = handle(app);

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
