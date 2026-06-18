import { z } from "zod";

import { DEFAULT_MODEL, getClient } from "./model.ts";

// ── The structured shape Claude must return (also the product's wire shape) ──
export const NextBestActionSchema = z.object({
  action: z.string().describe("A specific, concrete action the subject can take."),
  rationale: z.string().describe("Why this action, tied to the data."),
  targetMetric: z
    .string()
    .describe("The metric this should move, e.g. profile_views, contact_clicks."),
  effort: z.enum(["low", "medium", "high"]),
});

export const InsightContentSchema = z.object({
  narrative: z
    .string()
    .describe("2-4 sentences: what the data shows and what changed, plainly."),
  nextBestActions: z.array(NextBestActionSchema).min(1).max(4),
});

export type InsightContent = z.infer<typeof InsightContentSchema>;

export type InsightSubject = {
  scope: "graduate" | "school";
  name: string;
  /** Current-period metrics. */
  metrics: Record<string, number>;
  /** Delta vs the prior period (after - before). */
  deltas: Record<string, number>;
  /** What we recommended last time + whether it appears to have worked. */
  priorActions?: { action: string; targetMetric: string }[];
  priorVerdict?: "improved" | "flat" | "regressed" | "inconclusive";
  brandGuidelines?: string;
};

export type InsightResult = {
  content: InsightContent;
  usage: {
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    latencyMs: number;
    status: "ok" | "error" | "refusal";
    source: "claude" | "fallback";
  };
};

const SYSTEM = `You are the performance coach inside The Directory — an AI-native
marketplace of certified practitioners. You turn a graduate's or school's behavioral
analytics into a short, honest narrative and a few high-leverage next actions.
Be specific and grounded in the numbers provided. Never invent metrics. Prioritise
actions by expected impact. Respect any brand guidelines given. Keep it encouraging
but truthful — if something regressed, say so.`;

function buildPrompt(s: InsightSubject): string {
  const lines: string[] = [];
  lines.push(`Subject: ${s.scope} "${s.name}".`);
  lines.push(`Current metrics: ${JSON.stringify(s.metrics)}`);
  lines.push(`Change vs prior period: ${JSON.stringify(s.deltas)}`);
  if (s.priorActions?.length) {
    lines.push(
      `Last period we recommended: ${s.priorActions
        .map((a) => `"${a.action}" (to lift ${a.targetMetric})`)
        .join("; ")}.`,
    );
    lines.push(
      `Outcome of those recommendations: ${s.priorVerdict ?? "inconclusive"}. ` +
        `Take this into account — double down on what worked, change tack on what didn't.`,
    );
  }
  if (s.brandGuidelines) lines.push(`Brand guidelines: ${s.brandGuidelines}`);
  lines.push(
    `Write the narrative and 1-4 ranked next-best-actions for this ${s.scope}.`,
  );
  return lines.join("\n");
}

/** Pull the first JSON object out of a model response (tolerates code fences). */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON object in response");
  return JSON.parse(candidate.slice(start, end + 1));
}

export async function generateInsight(
  subject: InsightSubject,
): Promise<InsightResult> {
  const started = Date.now();
  const client = getClient();

  if (client) {
    try {
      // Version-robust: instruct JSON, then validate with zod. Works across SDK
      // versions and degrades to the fallback if anything is off.
      const response = await client.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 2000,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content:
              buildPrompt(subject) +
              "\n\nReturn ONLY a JSON object, no prose, matching exactly:\n" +
              `{"narrative": string, "nextBestActions": [{"action": string, "rationale": string, "targetMetric": string, "effort": "low"|"medium"|"high"}]}`,
          },
        ],
      });

      const text = response.content
        .map((b) => (b.type === "text" ? b.text : ""))
        .join("");
      const json = extractJson(text);
      const parsed = InsightContentSchema.parse(json);
      return {
        content: parsed,
        usage: {
          model: DEFAULT_MODEL,
          inputTokens: response.usage?.input_tokens,
          outputTokens: response.usage?.output_tokens,
          latencyMs: Date.now() - started,
          status: response.stop_reason === "refusal" ? "refusal" : "ok",
          source: "claude",
        },
      };
    } catch (err) {
      // Fall through to the deterministic fallback so the loop never hard-fails.
      console.warn("[ai] Claude insight generation failed, using fallback:", err);
    }
  }

  return {
    content: fallbackInsight(subject),
    usage: {
      model: "fallback-rules-v1",
      latencyMs: Date.now() - started,
      status: "ok",
      source: "fallback",
    },
  };
}

/**
 * Offline rule-based generator. Lets the nightly loop run end-to-end without an
 * API key — clearly labelled `source: "fallback"` so demos don't mistake it for Claude.
 */
export function fallbackInsight(s: InsightSubject): InsightContent {
  const m = s.metrics;
  const d = s.deltas;
  const views = m.profile_views ?? 0;
  const clicks = m.contact_clicks ?? 0;
  const viewDelta = d.profile_views ?? 0;

  const actions: z.infer<typeof NextBestActionSchema>[] = [];
  if (viewDelta < 0 || views < 20) {
    actions.push({
      action: "Refresh your headline and add two new gallery photos.",
      rationale: `Profile views are ${viewDelta < 0 ? "down" : "low"} (${views} this period). A sharper headline and fresh imagery lift discovery click-through.`,
      targetMetric: "profile_views",
      effort: "low",
    });
  }
  if (views > 0 && clicks / Math.max(views, 1) < 0.05) {
    actions.push({
      action: "Add clear session pricing and a single call-to-action to your profile.",
      rationale: `Only ${clicks} contacts from ${views} views — visitors aren't converting. Explicit pricing and a CTA reduce hesitation.`,
      targetMetric: "contact_clicks",
      effort: "medium",
    });
  }
  if (actions.length === 0) {
    actions.push({
      action: "Publish an availability update and confirm your modalities are current.",
      rationale: "Momentum is steady — keeping the profile fresh sustains ranking and trust.",
      targetMetric: "profile_views",
      effort: "low",
    });
  }

  const trend =
    viewDelta > 0 ? "trending up" : viewDelta < 0 ? "softening" : "holding steady";
  const narrative =
    `Over the latest period, ${s.name} is ${trend} with ${views} profile views and ${clicks} direct contacts` +
    (s.priorVerdict
      ? `. Previous recommendations ${s.priorVerdict === "improved" ? "appear to have helped" : "did not move the needle yet"}.`
      : ".") +
    " Focus on the actions below in order.";

  return { narrative, nextBestActions: actions };
}
