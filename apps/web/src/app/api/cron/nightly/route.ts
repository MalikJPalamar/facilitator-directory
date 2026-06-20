import { runNightly } from "@directory/worker/nightly";

/**
 * Nightly intelligence loop, triggered by Vercel Cron (see vercel.json). Runs
 * the SENSE→…→LEARN pass for every school + published graduate against the
 * hosted DB, so insights stay fresh without a long-lived worker.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET
 * is set on the project; we require it so the endpoint can't be triggered by
 * anyone. Node runtime (Postgres + Claude); generous maxDuration for the loop.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    await runNightly();
    return Response.json({ ok: true, seconds: (Date.now() - startedAt) / 1000 });
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
