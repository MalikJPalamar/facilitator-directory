import type { InsightDTO } from "@directory/contracts";

const VERDICT_COLOR: Record<string, string> = {
  improved: "#1e7a3c",
  flat: "#8a6d1f",
  regressed: "#b3261e",
  inconclusive: "#5a6b6f",
};

/** Renders one AI insight: the narrative, ranked next-best-actions, the metrics
 * snapshot, and — crucially — the scored OUTCOME of the prior recommendation
 * (the visible proof that the loop learns). */
export function InsightPanel({ insight }: { insight: InsightDTO }) {
  return (
    <section style={{ border: "1px solid #e2e8e9", borderRadius: 12, padding: 20, background: "#fff" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0 }}>AI insights &amp; coaching</h2>
        <span style={{ fontSize: ".75rem", color: "#5a6b6f" }}>
          v{insight.version} · {insight.source?.includes("fallback") ? "offline engine" : insight.source}
        </span>
      </div>

      <p style={{ fontSize: "1.05rem" }}>{insight.narrative}</p>

      {insight.outcome && (
        <p style={{ fontSize: ".85rem" }}>
          <strong>Last period&apos;s recommendation:</strong>{" "}
          <span style={{ color: VERDICT_COLOR[insight.outcome.verdict] ?? "#5a6b6f" }}>
            {insight.outcome.verdict}
          </span>{" "}
          (Δ {Object.entries(insight.outcome.delta)
            .filter(([, v]) => v !== 0)
            .map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`)
            .join(", ") || "no change"})
        </p>
      )}

      <h3 style={{ marginBottom: 8 }}>Next best actions</h3>
      <ol style={{ paddingLeft: 18 }}>
        {insight.nextBestActions.map((a, i) => (
          <li key={i} style={{ marginBottom: 8 }}>
            <strong>{a.action}</strong>{" "}
            <span style={{ fontSize: ".7rem", background: "#eef4f5", padding: "1px 6px", borderRadius: 999 }}>
              {a.effort} effort → {a.targetMetric}
            </span>
            <div style={{ fontSize: ".85rem", color: "#5a6b6f" }}>{a.rationale}</div>
          </li>
        ))}
      </ol>

      <h3 style={{ marginBottom: 8 }}>This period</h3>
      <ul style={{ fontSize: ".85rem", color: "#33484d" }}>
        {Object.entries(insight.metrics).map(([k, v]) => (
          <li key={k}>{k}: {v}</li>
        ))}
      </ul>
    </section>
  );
}
