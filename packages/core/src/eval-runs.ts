import { db, desc, tables } from "@directory/db";

export type EvalRunRow = typeof tables.evalRun.$inferSelect;

/**
 * The most-recent eval-harness runs, newest first, for the admin insight-quality
 * panel. Kept in @directory/core so the web layer never imports @directory/db
 * directly (the app talks to domain packages, not the DB).
 */
export async function listRecentEvalRuns(limit = 10): Promise<EvalRunRow[]> {
  return db
    .select()
    .from(tables.evalRun)
    .orderBy(desc(tables.evalRun.runAt))
    .limit(limit);
}
