import { generateInsight, type InsightSubject } from "./insights.ts";

/**
 * Trusted Evals (GOVERN/ASSURE pillar). A tiny, dependency-free rubric harness
 * for the insights engine. Run with `pnpm --filter @directory/ai evals`. The
 * nightly loop also samples this to guard against quiet drift.
 */

type Rubric = {
  name: string;
  subject: InsightSubject;
  /** Metrics the model is allowed to reference (no hallucinated metrics). */
  allowedMetrics: string[];
};

const KNOWN_METRICS = [
  "profile_views",
  "search_appearances",
  "contact_clicks",
  "booking_intent",
  "agent_queries",
];

const FIXTURES: Rubric[] = [
  {
    name: "declining graduate",
    subject: {
      scope: "graduate",
      name: "Maya Okonkwo",
      metrics: { profile_views: 14, search_appearances: 120, contact_clicks: 1 },
      deltas: { profile_views: -22, contact_clicks: -3 },
    },
    allowedMetrics: KNOWN_METRICS,
  },
  {
    name: "high-traffic low-conversion graduate",
    subject: {
      scope: "graduate",
      name: "Tomas Lindqvist",
      metrics: { profile_views: 210, search_appearances: 900, contact_clicks: 4 },
      deltas: { profile_views: 30, contact_clicks: 0 },
    },
    allowedMetrics: KNOWN_METRICS,
  },
  {
    name: "school overview",
    subject: {
      scope: "school",
      name: "Global Breathwork Collective",
      metrics: { profile_views: 4200, contact_clicks: 180, agent_queries: 90 },
      deltas: { profile_views: 600, agent_queries: 45 },
      priorActions: [
        { action: "Encourage graduates to add pricing", targetMetric: "contact_clicks" },
      ],
      priorVerdict: "improved",
    },
    allowedMetrics: KNOWN_METRICS,
  },
];

function scoreOne(rubric: Rubric, content: {
  narrative: string;
  nextBestActions: { action: string; targetMetric: string }[];
}): { passed: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!content.narrative || content.narrative.length < 20)
    reasons.push("narrative too short");
  if (content.nextBestActions.length < 1) reasons.push("no actions");
  for (const a of content.nextBestActions) {
    if (!a.action || a.action.length < 8) reasons.push("vague action");
    if (!rubric.allowedMetrics.includes(a.targetMetric))
      reasons.push(`hallucinated metric: ${a.targetMetric}`);
  }
  if (!/\d/.test(content.narrative))
    reasons.push("narrative not grounded in a number");
  return { passed: reasons.length === 0, reasons };
}

async function main() {
  let passed = 0;
  for (const rubric of FIXTURES) {
    const result = await generateInsight(rubric.subject);
    const score = scoreOne(rubric, result.content);
    const tag = score.passed ? "PASS" : "FAIL";
    console.log(
      `[${tag}] ${rubric.name} (${result.usage.source})` +
        (score.passed ? "" : ` — ${score.reasons.join(", ")}`),
    );
    if (score.passed) passed++;
  }
  const rate = ((passed / FIXTURES.length) * 100).toFixed(0);
  console.log(`\nEval pass rate: ${passed}/${FIXTURES.length} (${rate}%)`);
  if (passed < FIXTURES.length) process.exitCode = 1;
}

// Run directly (tsx src/evals.ts), not when imported.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
