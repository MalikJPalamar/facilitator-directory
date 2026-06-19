import { latestInsightDTO } from "@directory/core";

import { DEMO_ORG_ID } from "../../lib/data.ts";
import { InsightPanel } from "../insight-panel.tsx";

/** School admin dashboard (demo): school-level AI insights + billing link. */
export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const sp = await searchParams;
  const insight = await latestInsightDTO(sp.org ?? DEMO_ORG_ID, "school", null);

  return (
    <main>
      <p><a href="/">← Home</a></p>
      <h1>School admin</h1>
      {insight ? (
        <InsightPanel insight={insight} />
      ) : (
        <p>No school insight yet. Run <code>pnpm intelligence:nightly</code>.</p>
      )}
      <p style={{ marginTop: 24, color: "#5a6b6f", fontSize: ".9rem" }}>
        Members, certification verification, and the Stripe billing portal link
        mount here (minimal in this scaffold).
      </p>
    </main>
  );
}
