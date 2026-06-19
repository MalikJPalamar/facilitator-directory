import { env } from "@directory/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index.ts";
import { sslFor } from "./ssl.ts";

/**
 * The ONLY place that opens a Postgres connection. Everyone else imports `db`
 * (or, for tenant-scoped queries, `withTenant` from ./tenant.ts).
 */
const queryClient = postgres(env.DATABASE_URL, {
  max: 10,
  ssl: sslFor(env.DATABASE_URL),
});

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
export { queryClient };
export { schema };
