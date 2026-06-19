import { env } from "@directory/config";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema/index.ts";
import { sslFor } from "./ssl.ts";

/**
 * Lazy Postgres connection. The client is created on FIRST use, not at import
 * time, so importing anything in the DB graph (e.g. when Next evaluates the
 * embedded /api route during `next build`) never parses DATABASE_URL or opens a
 * socket. This keeps the build independent of runtime DB config.
 */
type DB = PostgresJsDatabase<typeof schema>;

let _sql: ReturnType<typeof postgres> | undefined;
let _db: DB | undefined;

function init(): DB {
  if (!_db) {
    _sql = postgres(env.DATABASE_URL, { max: 10, ssl: sslFor(env.DATABASE_URL) });
    _db = drizzle(_sql, { schema });
  }
  return _db;
}

function lazy<T extends object>(get: () => T): T {
  return new Proxy({} as T, {
    get(_t, prop) {
      const real = get() as Record<string | symbol, unknown>;
      const v = real[prop];
      return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
    },
  });
}

/** The Drizzle database handle (lazily initialised). */
export const db: DB = lazy(init);

/** The underlying postgres.js client — used to close the pool in scripts. */
export const queryClient = lazy(() => {
  init();
  return _sql!;
}) as ReturnType<typeof postgres>;

export type Database = DB;
export { schema };
