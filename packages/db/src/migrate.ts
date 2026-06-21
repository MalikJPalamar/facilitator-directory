import { env } from "@directory/config";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

import { sslFor } from "./ssl.ts";

/**
 * One command provisions everything: extensions → tables → RLS.
 *
 *   pnpm db:migrate
 *
 * Extensions are created first because the generated DDL references the
 * `vector` and `geography` types. Then Drizzle applies the generated migrations
 * from ./drizzle. Finally we install Row-Level Security policies + a non-owner
 * application role so tenant isolation is actually enforced for the app.
 */

// Tables with a direct `organization_id` column get a tenant-isolation RLS
// policy. `incentive_score` is intentionally excluded: it has no
// organization_id (it references graduate_profile, which is itself tenant-scoped,
// so it's protected transitively). Add it back only if it gains a tenant column.
const ORG_SCOPED_TABLES = [
  "graduate_profile",
  "location",
  "certification",
  "subscription",
  "billing_event",
  "analytics_event",
  "insight",
  "review_item",
  "ad_placement",
  "lead",
  "webhook_endpoint",
  "webhook_delivery",
  // NOTE: api_key + idempotency_key are intentionally NOT here. api_key is read
  // by key hash before any tenant context exists; idempotency_key has no
  // organization_id column. Both are scoped in application code instead.
];

async function main() {
  const client = postgres(env.DATABASE_URL, {
    max: 1,
    ssl: sslFor(env.DATABASE_URL),
  });
  const db = drizzle(client);

  console.log("→ enabling extensions (postgis, vector, pg_trgm)…");
  await db.execute(sql`create extension if not exists postgis`);
  await db.execute(sql`create extension if not exists vector`);
  await db.execute(sql`create extension if not exists pg_trgm`);
  await db.execute(sql`create extension if not exists "uuid-ossp"`);

  console.log("→ applying migrations…");
  await migrate(db, { migrationsFolder: "./drizzle" });

  console.log("→ installing Row-Level Security policies…");
  // A non-owner role the application connects as. RLS is enforced for it;
  // migrate/seed run as the owner (which bypasses RLS) so they can set up data.
  await db.execute(sql`
    do $$
    begin
      if not exists (select from pg_roles where rolname = 'directory_app') then
        create role directory_app login password 'directory_app';
      end if;
    end $$;
  `);
  await db.execute(
    sql`grant usage on schema public to directory_app`,
  );
  await db.execute(
    sql`grant select, insert, update, delete on all tables in schema public to directory_app`,
  );
  await db.execute(
    sql`alter default privileges in schema public grant select, insert, update, delete on tables to directory_app`,
  );

  for (const table of ORG_SCOPED_TABLES) {
    const ident = sql.raw(table);
    const policy = sql.raw(`${table}_tenant_isolation`);
    await db.execute(sql`alter table ${ident} enable row level security`);
    await db.execute(sql`drop policy if exists ${policy} on ${ident}`);
    // Reads/writes are limited to the current tenant (app.current_org GUC).
    await db.execute(sql`
      create policy ${policy} on ${ident}
        using (organization_id = current_setting('app.current_org', true))
        with check (organization_id = current_setting('app.current_org', true))
    `);
  }

  console.log("✓ migrate complete");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
