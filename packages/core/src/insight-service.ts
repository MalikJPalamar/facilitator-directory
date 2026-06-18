import { randomUUID } from "node:crypto";

import { generateInsight, type InsightSubject } from "@directory/ai";
import { and, db, desc, eq, isNull, sql, tables } from "@directory/db";
import type { InsightOutcome } from "@directory/db/schema";

import { deltaOf, getProfileMetrics, getSchoolMetrics, type Metrics } from "./metrics.ts";

const WINDOW_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

type Scope = "graduate" | "school";

async function getLatestInsight(
  organizationId: string,
  scope: Scope,
  profileId: string | null,
) {
  const profileCond =
    profileId === null
      ? isNull(tables.insight.profileId)
      : eq(tables.insight.profileId, profileId);
  const [row] = await db
    .select()
    .from(tables.insight)
    .where(and(eq(tables.insight.organizationId, organizationId), profileCond))
    .orderBy(desc(tables.insight.version))
    .limit(1);
  return row ?? null;
}

/**
 * Score how the PREVIOUS insight's recommendations actually performed — the
 * LEARN step that makes coaching iterative. Compares the metrics snapshot taken
 * when the prior insight was generated against the current period.
 */
function scoreOutcome(
  previous: { metrics: Metrics; nextBestActions: { targetMetric: string }[] },
  current: Metrics,
): InsightOutcome {
  const before = previous.metrics;
  const after = current;
  const delta = deltaOf(after, before);
  const targets = [
    ...new Set(previous.nextBestActions.map((a) => a.targetMetric)),
  ];
  const targetDelta = targets.reduce((sum, m) => sum + (delta[m] ?? 0), 0);
  const actedOn = targets.some((m) => (delta[m] ?? 0) !== 0);
  const verdict: InsightOutcome["verdict"] = !actedOn
    ? "inconclusive"
    : targetDelta > 0
      ? "improved"
      : targetDelta < 0
        ? "regressed"
        : "flat";
  return {
    evaluatedAt: new Date().toISOString(),
    previousTargetMetrics: targets,
    before,
    after,
    delta,
    actedOn,
    verdict,
  };
}

export type RunResult = {
  insightId: string;
  version: number;
  source: string;
  correlationId: string;
};

/** One subject's full SENSE→INTERPRET→DECIDE/ACT→LEARN→GOVERN cycle. */
async function runForSubject(opts: {
  organizationId: string;
  scope: Scope;
  profileId: string | null;
  name: string;
  brandGuidelines?: string;
  now: Date;
  computeMetrics: (from: Date, to: Date) => Promise<Metrics>;
}): Promise<RunResult> {
  const correlationId = randomUUID();
  const { now } = opts;
  const curFrom = new Date(now.getTime() - WINDOW_DAYS * DAY_MS);
  const prevFrom = new Date(now.getTime() - 2 * WINDOW_DAYS * DAY_MS);

  // SENSE + INTERPRET
  const current = await opts.computeMetrics(curFrom, now);
  const previousWindow = await opts.computeMetrics(prevFrom, curFrom);
  const deltas = deltaOf(current, previousWindow);

  // LEARN — score the prior insight against what actually happened.
  const prior = await getLatestInsight(
    opts.organizationId,
    opts.scope,
    opts.profileId,
  );
  let priorVerdict: InsightOutcome["verdict"] | undefined;
  if (prior) {
    const outcome = scoreOutcome(
      { metrics: prior.metrics, nextBestActions: prior.nextBestActions },
      current,
    );
    priorVerdict = outcome.verdict;
    await db
      .update(tables.insight)
      .set({ outcome })
      .where(eq(tables.insight.id, prior.id));
  }

  // DECIDE/ACT — generate the new insight.
  const subject: InsightSubject = {
    scope: opts.scope,
    name: opts.name,
    metrics: current,
    deltas,
    priorActions: prior?.nextBestActions.map((a) => ({
      action: a.action,
      targetMetric: a.targetMetric,
    })),
    priorVerdict,
    brandGuidelines: opts.brandGuidelines,
  };
  const result = await generateInsight(subject);
  const version = (prior?.version ?? 0) + 1;

  const [inserted] = await db
    .insert(tables.insight)
    .values({
      organizationId: opts.organizationId,
      profileId: opts.profileId,
      scope: opts.scope,
      version,
      status: "published",
      narrative: result.content.narrative,
      nextBestActions: result.content.nextBestActions,
      metrics: current,
      model: result.usage.model,
      correlationId,
    })
    .returning({ id: tables.insight.id });

  // GOVERN/ASSURE — Searchable Logs pillar.
  await db.insert(tables.aiCallLog).values({
    correlationId,
    organizationId: opts.organizationId,
    profileId: opts.profileId,
    purpose: "insight",
    model: result.usage.model,
    promptRef: `insight:${opts.scope}`,
    inputTokens: result.usage.inputTokens ?? null,
    outputTokens: result.usage.outputTokens ?? null,
    latencyMs: result.usage.latencyMs,
    status: result.usage.status,
  });

  return {
    insightId: inserted!.id,
    version,
    source: result.usage.source,
    correlationId,
  };
}

export function runInsightForProfile(args: {
  organizationId: string;
  profileId: string;
  name: string;
  brandGuidelines?: string;
  now?: Date;
}): Promise<RunResult> {
  return runForSubject({
    organizationId: args.organizationId,
    scope: "graduate",
    profileId: args.profileId,
    name: args.name,
    brandGuidelines: args.brandGuidelines,
    now: args.now ?? new Date(),
    computeMetrics: (from, to) => getProfileMetrics(args.profileId, from, to),
  });
}

export function runInsightForSchool(args: {
  organizationId: string;
  name: string;
  brandGuidelines?: string;
  now?: Date;
}): Promise<RunResult> {
  return runForSubject({
    organizationId: args.organizationId,
    scope: "school",
    profileId: null,
    name: args.name,
    brandGuidelines: args.brandGuidelines,
    now: args.now ?? new Date(),
    computeMetrics: (from, to) => getSchoolMetrics(args.organizationId, from, to),
  });
}

/** Latest insight for a graduate/school, as the API/MCP return it. */
export async function latestInsightDTO(
  organizationId: string,
  scope: Scope,
  profileId: string | null,
) {
  const row = await getLatestInsight(organizationId, scope, profileId);
  if (!row) return null;
  return {
    id: row.id,
    scope: row.scope as Scope,
    version: row.version,
    narrative: row.narrative,
    nextBestActions: row.nextBestActions,
    metrics: row.metrics,
    outcome: row.outcome
      ? { verdict: row.outcome.verdict, delta: row.outcome.delta }
      : null,
    source: row.model ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export { sql };
