import { runNightly } from "./nightly.ts";

/**
 * Always-on scheduler. The product has ONE heartbeat: this process runs the
 * nightly iterative loop on a daily cadence. In production this maps to a Render
 * cron service (see render.yaml) or a Claude Managed Agents scheduled deployment.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

async function tick() {
  try {
    console.log(`[worker] nightly loop starting at ${new Date().toISOString()}`);
    await runNightly();
  } catch (err) {
    console.error("[worker] nightly loop failed:", err);
  }
}

console.log("[worker] scheduler up — running nightly loop every 24h.");
void tick();
setInterval(() => void tick(), DAY_MS);
