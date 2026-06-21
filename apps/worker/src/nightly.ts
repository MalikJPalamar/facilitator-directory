import { and, db, eq, queryClient, tables } from "@directory/db";
import {
  runEvals,
  runInsightForProfile,
  runInsightForSchool,
} from "@directory/core";

/**
 * The nightly iterative loop (the LEARN cycle).
 *
 * For every school and every published graduate, run one full Intelligence
 * Stack pass: SENSE the day's events → INTERPRET → DECIDE/ACT (regenerate the
 * insight) → LEARN (score the prior insight against what actually happened) →
 * GOVERN/ASSURE (log every AI call by correlation_id). Idempotent and manually
 * triggerable: `pnpm intelligence:nightly`.
 *
 * One scheduler, one heartbeat — future loops (incentive recompute, index
 * reconciliation) hang off the same run.
 */
export async function runNightly(now = new Date()): Promise<void> {
  const startedAt = Date.now();
  const orgs = await db.select().from(tables.organization);
  let profileRuns = 0;
  let schoolRuns = 0;
  let claudeRuns = 0;

  for (const org of orgs) {
    const brandGuidelines = org.metadata?.brandGuidelines;

    const profiles = await db
      .select({
        id: tables.graduateProfile.id,
        name: tables.graduateProfile.displayName,
      })
      .from(tables.graduateProfile)
      .where(
        and(
          eq(tables.graduateProfile.organizationId, org.id),
          eq(tables.graduateProfile.status, "published"),
        ),
      );

    for (const p of profiles) {
      const r = await runInsightForProfile({
        organizationId: org.id,
        profileId: p.id,
        name: p.name,
        brandGuidelines,
        now,
      });
      profileRuns++;
      if (r.source === "claude") claudeRuns++;
    }

    const s = await runInsightForSchool({
      organizationId: org.id,
      name: org.name,
      brandGuidelines,
      now,
    });
    schoolRuns++;
    if (s.source === "claude") claudeRuns++;
  }

  const secs = ((Date.now() - startedAt) / 1000).toFixed(1);
  console.log(
    `✓ nightly loop complete in ${secs}s — ${profileRuns} graduate insights, ` +
      `${schoolRuns} school insights (${claudeRuns} via Claude, rest via offline fallback).`,
  );

  // GOVERN/ASSURE: sample the trusted-eval harness and persist one eval_run row
  // so the admin dashboard can chart insight quality over time. Never let an
  // eval failure abort the nightly insights — log and move on.
  try {
    const evals = await runEvals();
    await db.insert(tables.evalRun).values({
      passed: evals.passed,
      total: evals.total,
      passRate: evals.passRate,
      source: evals.source,
      failures: evals.failures,
    });
    const ratePct = (evals.passRate * 100).toFixed(0);
    console.log(
      `✓ eval run logged — ${evals.passed}/${evals.total} (${ratePct}%) via ${evals.source}.`,
    );
  } catch (err) {
    console.error("⚠ eval run skipped (nightly insights unaffected):", err);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runNightly()
    .then(() => queryClient.end())
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
