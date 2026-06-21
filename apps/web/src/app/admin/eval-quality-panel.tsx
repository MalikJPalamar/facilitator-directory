import { listRecentEvalRuns } from "@directory/core";

/**
 * Insight-engine quality over time (GOVERN/ASSURE). Reads the latest eval_run
 * rows the nightly loop persists and surfaces the current pass-rate plus a
 * compact trend, so an admin can see at a glance whether insight quality holds
 * as the model/prompt evolves. `source` is shown so a green run on the
 * deterministic fallback isn't mistaken for a validated Claude path.
 */
export async function EvalQualityPanel() {
  const runs = await listRecentEvalRuns(10);

  if (runs.length === 0) {
    return (
      <section className="panel">
        <h2 style={{ fontSize: "var(--fs-h3)", margin: 0 }}>Insight quality</h2>
        <p className="muted" style={{ margin: 0, fontSize: "var(--fs-sm)" }}>
          No eval runs yet. The nightly loop logs one each run — try{" "}
          <code>pnpm intelligence:nightly</code>.
        </p>
      </section>
    );
  }

  const latest = runs[0]!;
  const latestPct = Math.round(latest.passRate * 100);
  const latestOk = latest.source === "claude";

  return (
    <section className="panel">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--space-3)",
        }}
      >
        <h2 style={{ fontSize: "var(--fs-h3)", margin: 0 }}>Insight quality</h2>
        <span className={`badge ${latestOk ? "badge-verified" : "badge-online"}`}>
          {latest.source}
        </span>
      </div>

      <p style={{ fontSize: "var(--fs-h2)", fontWeight: 700, margin: "var(--space-2) 0 0" }}>
        {latestPct}%{" "}
        <span className="muted" style={{ fontSize: "var(--fs-sm)", fontWeight: 400 }}>
          pass rate · {latest.passed}/{latest.total} ·{" "}
          {new Date(latest.runAt).toLocaleDateString()}
        </span>
      </p>

      <div className="stack" style={{ marginTop: "var(--space-3)", gap: "var(--space-2)" }}>
        {runs.map((r) => {
          const pct = Math.round(r.passRate * 100);
          return (
            <div
              key={r.id}
              style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}
            >
              <span
                className="muted"
                style={{ fontSize: "var(--fs-xs)", minWidth: "5.5rem" }}
              >
                {new Date(r.runAt).toLocaleDateString()}
              </span>
              <div
                style={{
                  flex: 1,
                  height: "0.5rem",
                  borderRadius: "var(--radius-sm, 4px)",
                  background: "var(--color-surface)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: r.source === "claude" ? "#1e7a3c" : "#8a6d1f",
                  }}
                />
              </div>
              <span style={{ fontSize: "var(--fs-xs)", minWidth: "5.5rem", textAlign: "right" }}>
                {pct}% · {r.passed}/{r.total}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
