import { sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";

import { db } from "./client.ts";

/**
 * Multi-tenant isolation, defense-in-depth.
 *
 * `withTenant(orgId, fn)` opens a transaction, sets the `app.current_org` GUC
 * (which Postgres Row-Level Security policies read — see migrations/rls.sql),
 * and runs `fn` with a transaction handle. This is the ONLY sanctioned way to
 * read/write tenant-scoped tables. Even a buggy query physically cannot read
 * another school's rows, because RLS filters on the GUC.
 *
 * Code-review rule: no raw tenant query outside `withTenant`.
 */
export async function withTenant<T>(
  organizationId: string,
  fn: (tx: PgTransaction<any, any, any>) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // `true` => transaction-local; reset automatically at COMMIT/ROLLBACK.
    await tx.execute(
      sql`select set_config('app.current_org', ${organizationId}, true)`,
    );
    return fn(tx as unknown as PgTransaction<any, any, any>);
  });
}
