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
    <section className="panel panel--accent">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--space-3)" }}>
        <h2 style={{ margin: 0, fontSize: "var(--fs-h2)" }}>AI insights &amp; coaching</h2>
        <span className="muted" style={{ fontSize: "var(--fs-xs)" }}>
          v{insight.version} · {insight.source?.includes("fallback") ? "offline engine" : insight.source}
        </span>
      </div>

      <p style={{ fontSize: "1.05rem" }}>{insight.narrative}</p>

      {insight.outcome && (
        <p style={{ fontSize: "var(--fs-sm)" }}>
          <strong>Last period&apos;s recommendation:</strong>{" "}
          <span style={{ color: VERDICT_COLOR[insight.outcome.verdict] ?? "var(--color-text-muted)", fontWeight: 600 }}>
            {insight.outcome.verdict}
          </span>{" "}
          (Δ {Object.entries(insight.outcome.delta)
            .filter(([, v]) => v !== 0)
            .map(([k, v]) => `${k} ${v > 0 ? "+" : ""}${v}`)
            .join(", ") || "no change"})
        </p>
      )}

      <h3 style={{ marginBottom: "var(--space-2)", fontSize: "var(--fs-h3)" }}>Next best actions</h3>
      <ol style={{ paddingLeft: 18, margin: 0 }}>
        {insight.nextBestActions.map((a, i) => (
          <li key={i} style={{ marginBottom: "var(--space-3)" }}>
            <strong>{a.action}</strong>{" "}
            <span className="badge badge-verified" style={{ fontWeight: 600 }}>
              {a.effort} effort → {a.targetMetric}
            </span>
            <div className="muted" style={{ fontSize: "var(--fs-sm)" }}>{a.rationale}</div>
          </li>
        ))}
      </ol>

      <h3 style={{ marginBottom: "var(--space-2)", marginTop: "var(--space-4)", fontSize: "var(--fs-h3)" }}>This period</h3>
      <div className="p-card__badges">
        {Object.entries(insight.metrics).map(([k, v]) => (
          <span key={k} className="badge" style={{ background: "var(--color-surface)", color: "var(--color-text)" }}>
            {k}: {v}
          </span>
        ))}
      </div>
    </section>
  );
}
