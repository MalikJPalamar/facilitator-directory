/**
 * SSL policy for the Postgres connection.
 *
 * Local Docker Postgres uses no TLS; hosted providers (Neon, Supabase, RDS)
 * require it. We enable `require` for any non-local host (or when the URL asks
 * for sslmode), so the same code runs against local Docker and hosted Postgres
 * without a config change.
 */
export function sslFor(databaseUrl: string): "require" | false {
  try {
    const u = new URL(databaseUrl);
    const host = u.hostname;
    const isLocal =
      host === "localhost" || host === "127.0.0.1" || host === "::1";
    if (isLocal && u.searchParams.get("sslmode") !== "require") return false;
    return "require";
  } catch {
    return false;
  }
}
