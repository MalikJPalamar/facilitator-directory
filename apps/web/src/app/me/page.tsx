import { latestInsightDTO } from "@directory/core";

import { DEMO_ORG_ID } from "../../lib/data.ts";
import { InsightPanel } from "../insight-panel.tsx";

/** Graduate dashboard (demo). In production the org + profile come from the
 * authenticated session/token; here we pass them as the validated-claim headers. */
export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ profile?: string; org?: string }>;
}) {
  const sp = await searchParams;
  if (!sp.profile) {
    return (
      <main>
        <h1>Graduate dashboard</h1>
        <p>Open this from a directory card&apos;s &quot;View AI insights&quot; link, or pass <code>?profile=&lt;id&gt;</code>.</p>
      </main>
    );
  }

  const insight = await latestInsightDTO(
    sp.org ?? DEMO_ORG_ID,
    "graduate",
    sp.profile,
  );

  return (
    <main>
      <p><a href="/breathwork-global">← Directory</a></p>
      <h1>Your performance</h1>
      {insight ? (
        <InsightPanel insight={insight} />
      ) : (
        <p>No insight yet. Seed the DB and run <code>pnpm intelligence:nightly</code>.</p>
      )}
    </main>
  );
}
